'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import * as jbossConst from "../JBOSS/JbossConstants";
import { Utility } from "../Utility";
import { JbossServer } from "./JbossServer";

export class JbossModel {
    private _serverList: JbossServer[] = [];
    private _serversJsonFile: string;

    constructor(public defaultStoragePath: string) {
        this._serversJsonFile = path.join(defaultStoragePath, 'servers.json');
        this.initServerListSync();
    }

    public getServerSet(): JbossServer[] {
        return this._serverList;
    }

    public getJbossServer(serverName: string): JbossServer | undefined {
        return this._serverList.find((item: JbossServer) => item.getName() === serverName);
    }

    public async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList.map((s: JbossServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
            vscode.commands.executeCommand('jboss.tree.refresh');
        } catch (err) {
            console.error(err.toString());
        }
    }

    public async updateJVMOptions(serverName: string) : Promise<void> {
        const server: JbossServer = this.getJbossServer(serverName);
        /*const installPath: string = server.getInstallPath();
        const catalinaBase: string = server.getStoragePath();
        const bootStrap: string = path.join(installPath, 'jboss-modules.jar');
        const jboss: string = path.join(installPath, 'bin', 'jboss-juli.jar');
        
        let result: string[] = [
            `${Constants.CLASS_PATH_KEY} "${[bootStrap, jboss].join(path.delimiter)}"`,
            `${Constants.JBOSS_BASE_KEY}="${catalinaBase}"`,
            `${Constants.JBOSS_HOME_KEY}="${installPath}"`,
            `${Constants.ENCODING}`
        ];

        if (!await fse.pathExists(server.jvmOptionFile)) {
            server.jvmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
            return;
        }*/
        const filterFunction: (para: string) => boolean = (para: string): boolean => {
            if (!(para.startsWith('-') || para.startsWith('${'))) {
                console.log(para);
                return false;
            }
            let valid: boolean = true;
            Constants.JVM_DEFAULT_OPTIONS_KEYS.forEach((key: string) => {
                if (para.startsWith(key)) {
                    valid = false;
                    return;
                }
            });
            return valid;
        };
       let result:string[] = await Utility.readFileLineByLine(server.jvmOptionFile, filterFunction);
       server.jvmOptions=result;
        /*const tmpDirConfiguration: string = result.find((element: string) => {
            return element.indexOf(Constants.JAVA_IO_TEMP_DIR_KEY) >= 0;
        });
        if (!tmpDirConfiguration) {
            result = result.concat(`${Constants.JAVA_IO_TEMP_DIR_KEY}="${path.join(catalinaBase, 'temp')}"`);
        }
        server.jvmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);*/
    }

    public deleteServer(jbossServer: JbossServer): boolean {
        const index: number = this._serverList.findIndex((item: JbossServer) => item.getName() === jbossServer.getName());
        if (index > -1) {
            const oldServer: JbossServer[] = this._serverList.splice(index, 1);
            if (!_.isEmpty(oldServer)) {
                fse.remove(jbossServer.getStoragePath());
                this.saveServerList();
                return true;
            }
        }

        return false;
    }

    public addServer(jbossServer: JbossServer): void {
        const index: number = this._serverList.findIndex((item: JbossServer) => item.getName() === jbossServer.getName());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(jbossServer);
        this.saveServerList();
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._serversJsonFile, this._serverList.map((s: JbossServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (!_.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string }) => {
                            return new JbossServer(obj._name, obj._installPath, obj._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}
