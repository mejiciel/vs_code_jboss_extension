'use strict';

import * as chokidar from "chokidar";
import * as fse from "fs-extra";
import * as _ from "lodash";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as portfinder from "portfinder";
import { URL } from "url";
import { MessageItem } from "vscode";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import * as Constants from "../Constants";
import * as jbossConst from "./JbossConstants";
import { DialogMessage } from '../DialogMessage';
import { Utility } from "../Utility";
import { JbossModel } from "./JbossModel";
import { JbossServer } from "./JbossServer";
import { WarPackage } from "./WarPackage";

export class JbossController {
    private _outputChannel: vscode.OutputChannel;
    constructor(private _jbossModel: JbossModel, private _extensionPath: string) {
        this._outputChannel = vscode.window.createOutputChannel('vscode-jboss');
    }

    public async deleteServer(jbossServer: JbossServer): Promise<void> {
        const server: JbossServer = await this.precheck(jbossServer);
        if (server) {
            if (server.isStarted()) {
                const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
                if (confirmation !== DialogMessage.yes) {
                    Utility.trackTelemetryStep('cancel');
                    return;
                }
                await this.stopOrRestartServer(server);
            }
            this._jbossModel.deleteServer(server);
        }
    }

    public async openServerConfig(jbossServer: JbossServer): Promise<void> {
        if (jbossServer) {
            const configFile: string = jbossServer.getServerConfigPath();
            if (!await fse.pathExists(configFile)) {
                Utility.trackTelemetryStep('no configuration');
                throw new Error(DialogMessage.noServerConfig);
            }
            Utility.trackTelemetryStep('open configuration');
            Utility.openFile(configFile);
        }
    }

    public async browseWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            const server: JbossServer = this._jbossModel.getJbossServer(warPackage.serverName);
            const httpPort: string = await Utility.getPort(server.getServerConfigPath(), Constants.PortKind.Http);
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    Utility.trackTelemetryStep('start server');
                    this.startServer(server);
                }
            }
            Utility.trackTelemetryStep('browse war');
            opn(new URL(warPackage.label, `${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public async deleteWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            await fse.remove(warPackage.storagePath);
            vscode.commands.executeCommand('jboss.tree.refresh');
        }
    }

    public revealWarPackage(warPackage: WarPackage): void {
        if (warPackage) {
            opn(warPackage.storagePath);
        }
    }

    public async addServer(): Promise<JbossServer> {
        Utility.trackTelemetryStep('select install path');
        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
        if (_.isEmpty(pathPick) || !pathPick[0].fsPath) {
            return;
        }
        const jbossInstallPath: string = pathPick[0].fsPath;
        if (!await Utility.validateInstallPath(jbossInstallPath)) {
            vscode.window.showErrorMessage(Constants.INVALID_SERVER_DIRECTORY);
            Utility.trackTelemetryStep('install path invalid');
            return;
        }
        Utility.trackTelemetryStep('construct server name');
        const serverName: string = await Utility.getServerName(jbossInstallPath, this._jbossModel.defaultStoragePath);
        const catalinaBasePath: string = await Utility.getServerStoragePath(this._jbossModel.defaultStoragePath, serverName);
        await fse.remove(catalinaBasePath);
        Utility.trackTelemetryStep('copy files');
        await Promise.all([
            fse.copy(path.join(jbossInstallPath, jbossConst.JBOSS_STANDALONE_CONF_PATH), path.join(catalinaBasePath, jbossConst.JBOSS_STANDALONE_CONF_DIR)),
            fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(catalinaBasePath, 'jvm.options')),
            fse.copy(path.join(this._extensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.copy(path.join(this._extensionPath, 'resources', 'icon.png'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'icon.png')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);
        //await Utility.copyServerConfig(path.join(jbossInstallPath, 'conf', 'server.xml'), path.join(catalinaBasePath, 'conf', 'server.xml'));
        const jbossServer: JbossServer = new JbossServer(serverName, jbossInstallPath, catalinaBasePath);
        Utility.trackTelemetryStep('add server');
        this._jbossModel.addServer(jbossServer);
        return jbossServer;
    }

    public async customizeJVMOptions(jbossServer: JbossServer): Promise<void> {
        if (jbossServer) {
            if (!await fse.pathExists(jbossServer.jvmOptionFile)) {
                await fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(jbossServer.getStoragePath(), 'jvm.options'));
            }
            Utility.openFile(jbossServer.jvmOptionFile);
        }
    }

    public async renameServer(jbossServer: JbossServer): Promise<void> {
        const server: JbossServer = await this.precheck(jbossServer);
        if (server) {
            const newName: string = await vscode.window.showInputBox({
                prompt: 'input a new server name',
                validateInput: (name: string): string => {
                    if (name && !name.match(/^[\w.-]+$/)) {
                        return 'please input a valid server name';
                    } else if (this._jbossModel.getJbossServer(name)) {
                        return 'the name was already taken, please re-input';
                    }
                    return null;
                }
            });
            if (newName) {
                Utility.trackTelemetryStep('rename');
                server.rename(newName);
                await this._jbossModel.saveServerList();
            }
        }
    }

    public async stopOrRestartServer(jbossServer: JbossServer, restart: boolean = false): Promise<void> {
        const server: JbossServer = await this.precheck(jbossServer);
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }
            Utility.trackTelemetryStep(restart ? 'restart' : 'stop');
            await Utility.executeCMD(this._outputChannel, jbossServer.getName(), 'java', { shell: true }, ...server.jvmOptions.concat('stop'));
            if (!restart) {
                server.clearDebugInfo();
            }
            server.needRestart = restart;
        }
    }

    public async startServer(jbossServer: JbossServer): Promise<void> {
        const server: JbossServer = jbossServer ? jbossServer : await this.selectServer(true);
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            await this.startJboss(server);
        }
    }

    public async runOrDebugOnServer(uri: vscode.Uri, debug?: boolean, server?: JbossServer): Promise<void> {
        if (!uri) {
            Utility.trackTelemetryStep('select war');
            const dialog: vscode.Uri[] = await vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: DialogMessage.selectWarPackage
            });
            if (_.isEmpty(dialog) || !dialog[0].fsPath) {
                return;
            }
            uri = dialog[0];
        }

        const packagePath: string = uri.fsPath;
        if (!server) {
            server = await this.selectServer(true);
        }
        if (!server) {
            Utility.trackTelemetryStep('cancel');
            return;
        }
        await this.deployPackage(server, packagePath);
        if (server.isStarted() && ((!server.isDebugging() && !debug) || server.isDebugging() === debug)) {
            return;
        }
        let port: number;
        let workspaceFolder: vscode.WorkspaceFolder;

        if (debug) {
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                    const relativePath: string = path.relative(f.uri.fsPath, packagePath);
                    return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== packagePath);
                });
            }
            if (!workspaceFolder) {
                Utility.trackTelemetryStep('no proper workspace folder');
                vscode.window.showErrorMessage(DialogMessage.noPackage);
                return;
            }
            Utility.trackTelemetryStep('get debug port');
            port = await portfinder.getPortPromise();
        }

        server.setDebugInfo(debug, port, workspaceFolder);
        if (server.isStarted()) {
            Utility.trackTelemetryStep('restart');
            await this.stopOrRestartServer(server, true);
        } else {
            Utility.trackTelemetryStep('start');
            await this.startJboss(server);
        }
    }

    public async browseServer(jbossServer: JbossServer): Promise<void> {
        if (jbossServer) {
            if (!jbossServer.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(jbossServer);
            }
            Utility.trackTelemetryStep('get http port');
            const httpPort: string = await Utility.getPort(jbossServer.getServerConfigPath(), Constants.PortKind.Http);
            Utility.trackTelemetryStep('browse server');
            opn(new URL(`${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public dispose(): void {
        this._jbossModel.getServerSet().forEach((element: JbossServer) => {
            if (element.isStarted()) {
                this.stopOrRestartServer(element);
            }
            this._outputChannel.dispose();
        });
        this._jbossModel.saveServerListSync();
    }

    private async selectServer(createIfNoneServer: boolean = false): Promise<JbossServer> {
        let items: vscode.QuickPickItem[] = this._jbossModel.getServerSet();
        if (_.isEmpty(items) && !createIfNoneServer) {
            return;
        }
        if (items.length === 1) {
            Utility.trackTelemetryStep('auto select the only server');
            return <JbossServer>items[0];
        }
        items = createIfNoneServer ? items.concat({ label: `$(plus) ${DialogMessage.addServer}`, description: '' }) : items;
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            items,
            { placeHolder: createIfNoneServer && items.length === 1 ? DialogMessage.addServer : DialogMessage.selectServer }
        );

        if (pick) {
            if (pick instanceof JbossServer) {
                Utility.trackTelemetryStep('select server');
                return pick;
            } else {
                Utility.trackTelemetryStep('add server');
                return await this.addServer();
            }
        }
    }

    private async deployPackage(serverInfo: JbossServer, packagePath: string): Promise<void> {
        const appName: string = path.basename(packagePath, path.extname(packagePath));
        const appPath: string = path.join(serverInfo.getStoragePath(), 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        Utility.trackTelemetryStep('deploy war');
        await Utility.executeCMD(this._outputChannel, serverInfo.getName(), 'jar', { cwd: appPath }, 'xvf', `${packagePath}`);
        vscode.commands.executeCommand('jboss.tree.refresh');
    }

    private startDebugSession(server: JbossServer): void {
        if (!server || !server.getDebugPort() || !server.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: 'Jboss Debug (Attach)',
            request: 'attach',
            hostName: 'localhost',
            port: server.getDebugPort()
        };
        Utility.trackTelemetryStep('start debug');
        setTimeout(() => vscode.debug.startDebugging(server.getDebugWorkspace(), config), 500);
    }

    private async startJboss(serverInfo: JbossServer): Promise<void> {
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);

        try {
            await this._jbossModel.updateJVMOptions(serverName);
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    Utility.trackTelemetryStep('server port changed');
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );

                    if (result === DialogMessage.yes) {
                        Utility.trackTelemetryStep('revert');
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        Utility.trackTelemetryStep('more info clicked');
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                    Utility.trackTelemetryStep('http(s) port changed');
                    const item: MessageItem = await vscode.window.showWarningMessage(
                        DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                    );

                    if (item === DialogMessage.yes) {
                        await this.stopOrRestartServer(serverInfo, true);
                    } else if (item === DialogMessage.never) {
                        Utility.trackTelemetryStep('disable auto restart');
                        Utility.disableAutoRestart();
                    }
                }
            });

            let startArguments: string[] = serverInfo.jvmOptions.slice();
            if (serverInfo.getDebugPort()) {
                startArguments = [`${Constants.DEBUG_ARGUMENT_KEY}${serverInfo.getDebugPort()}`].concat(startArguments);
            }
            startArguments.push('start');
            const javaProcess: Promise<void> = Utility.executeCMD(this._outputChannel, serverInfo.getName(), 'java', { shell: true }, ...startArguments);
            serverInfo.setStarted(true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startJboss(serverInfo);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            if (watcher) { watcher.close(); }
            TelemetryWrapper.error(err);
            vscode.window.showErrorMessage(err.toString());
        }
    }
    private async precheck(jbossServer: JbossServer): Promise<JbossServer> {
        if (_.isEmpty(this._jbossModel.getServerSet())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        return jbossServer ? jbossServer : await this.selectServer();
    }
}
