'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import * as vscode from "vscode";
import { Session, TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import * as xml2js from "xml2js";
import * as Constants from "./Constants";
import * as jbossConst from "./JBOSS/JbossConstants";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';

/* tslint:disable:no-any */
export namespace Utility {
    export async function executeCMD(outputPane: vscode.OutputChannel, serverName: string, command: string, options: child_process.SpawnOptions, ...args: string[]): Promise<child_process.ChildProcess> {
        return await new Promise<child_process.ChildProcess>((resolve, reject) => {
            outputPane.show();
            let stderr: string = '';
            const p: child_process.ChildProcess = child_process.spawn(command, args, options);
            p.stdout.on('data', (data: string | Buffer): void =>
                outputPane.append(`[${serverName}]: ${data.toString()}`));
            p.stderr.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(`[${serverName}]: ${data.toString()}`);
            });
            p.on('error', (err: Error) => {
                reject(err);
            });
            p.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(localize('jbossExt.commandfailed', 'Command failed with exit code {0}', code)));
                }
                resolve(null);
            });

            resolve(p);
            
        });
        
    }

    export async function openFile(file: string): Promise<void> {
        if (!await fse.pathExists(file)) {
            throw new Error(localize('jbossExt.fileNotExist', `File ${file} does not exist.`));
        }
        vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
    }
    export function trackTelemetryStep(step: string): void {
        const session: Session = TelemetryWrapper.currentSession();
        if (session && session.extraProperties) { session.extraProperties.finishedSteps.push(step); }
        TelemetryWrapper.info(step);
    }

    export function initTelemetrySteps(): void {
        const session: Session = TelemetryWrapper.currentSession();
        if (session && session.extraProperties) { session.extraProperties.finishedSteps = []; }
    }

    export function disableAutoRestart(): void {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('jboss');
        if (config) {
            config.update(Constants.RESTART_CONFIG_ID, false, true);
        }
    }

    export async function getServerStoragePath(defaultStoragePath: string, serverName: string): Promise<string> {
        return path.join(await getWorkspace(defaultStoragePath), serverName);
    }

    export async function getServerName(installPath: string, defaultStoragePath: string): Promise<string> {
        const workspace: string = await getWorkspace(defaultStoragePath);
        await fse.ensureDir(workspace);
        const fileNames: string[] = await fse.readdir(workspace);
        let serverName: string = path.basename(installPath);
        let index: number = 1;
        while (fileNames.indexOf(serverName) >= 0) {
            serverName = path.basename(installPath).concat(`-${index}`);
            index += 1;
        }
        return serverName;
    }

    async function getWorkspace(defaultStoragePath: string): Promise<string> {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('jboss');
        if (config) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const workspace: string = config.get<string>('workspace');
            if (workspace && workspace !== '') {
                await fse.ensureDir(workspace);
                return workspace;
            }
        }
        return path.join(defaultStoragePath, 'jboss');
    }

    export async function validateInstallPath(installPath: string): Promise<boolean> {
        const configFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, jbossConst.JBOSS_STANDALONE_CONF_PATH, jbossConst.JBOSS_STANDALONE_CONF_XML));
        //const serverWebFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'web.xml'));
        
        const serverBootstrapJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, jbossConst.JBOSS_BOOTSTRAP_JAR));
        //const serverJuliJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'jboss-juli.jar'));

        //return await configFileExists && await serverWebFileExists && await serverBootstrapJarFileExists && await serverJuliJarFileExists;
        return await configFileExists && await serverBootstrapJarFileExists;
    }

    export async function needRestart(httpPort: string, httpsPort: string, serverConfog: string): Promise<boolean> {
        const newHttpPort: string = await getPort(serverConfog, Constants.PortKind.Http);
        const newHttpsPort: string = await getPort(serverConfog, Constants.PortKind.Https);
        let restartConfig: boolean = false;
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('jboss');
        if (config) {
            restartConfig = config.get<boolean>(Constants.RESTART_CONFIG_ID);
        }
        return restartConfig && (httpPort !== newHttpPort || httpsPort !== newHttpsPort);
    }

    export async function readFileLineByLine(file: string, filterFunction?: (value: string) => boolean): Promise<string[]> {
        let result: string[] = [];
        await new Promise((resolve: () => void): void => {
            const lineReader: readline.ReadLine = readline.createInterface({
                input: fse.createReadStream(file),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line: string) => {
                if (!filterFunction || filterFunction(line)) {
                    result = result.concat(line);
                }
            });
            lineReader.on('close', () => {
                resolve();
            });
        });
        return result;
    }

    export function getTempStoragePath(): string {
        const chars: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
        let result: string = '';
        for (let i: number = 0; i < 5; i += 1) {
            // tslint:disable-next-line:insecure-random
            const idx: number = Math.floor(chars.length * Math.random());
            result += chars[idx];
        }
        return path.resolve(os.tmpdir(), `vscodejboss_${result}`);
    }

    export async function getPort(serverXml: string, kind: Constants.PortKind): Promise<string> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        let port: string;
        try {
            const jsonObj: any = await parseXml(xml);
            var z =jsonObj.server['socket-binding-group'][0]['socket-binding'];
            if (kind === Constants.PortKind.Server) {
                var y=z.find((item:any)=>item.$.name=='management-http');
                var regex:RegExp=new RegExp(/\${(.*):(\d+)}/g);
                if(regex!=null)
                {
                    port=regex.exec(<string>y.$.port)[2];
                    console.log('Found server port:'+port);
                }
                else 
                    throw new Error('Server Port not found');
                
            } else if (kind === Constants.PortKind.Http) {
                port = z.find((item:any)=>item.$.name==Constants.PortKind.Http).$.port;
                console.log('Found Http Port:'+port);
            } else if (kind === Constants.PortKind.Https) {
                port = z.find((item:any)=>item.$.name==Constants.PortKind.Https).$.port;
                console.log('Found Https Port:'+port);
            }
        } catch (err) {
            port = undefined;
            console.error(err);
        }
        return port;
    }

    export async function setPort(serverXml: string, kind: Constants.PortKind, value: string): Promise<void> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        const jsonObj: any = await parseXml(xml);
        if (kind === Constants.PortKind.Server) {
            jsonObj.Server.$.port = value;
        } else {
            const catalinaService: any = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA);

            if (kind === Constants.PortKind.Http) {
                const httpConnector: any = catalinaService.Connector.find((item: any) => (!item.$.protocol || item.$.protocol.startsWith(Constants.HTTP)));
                httpConnector.$.port = value;
            } else if (kind === Constants.PortKind.Https) {
                const httpsConnector: any = catalinaService.Connector.find((item: any) => (item.$.SSLEnabled.toLowerCase() === 'true'));
                httpsConnector.$.port = value;
            }
        }
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.writeFile(serverXml, newXml);
    }

    export async function copyServerConfig(source: string, target: string): Promise<void> {
        const xml: string = await fse.readFile(source, 'utf8');
        const jsonObj: {} = await parseXml(xml);
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.ensureFile(target);
        await fse.writeFile(target, newXml);
    }

    async function parseXml(xml: string): Promise<any> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: Error, res: {}) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
}
