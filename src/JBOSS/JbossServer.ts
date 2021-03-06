'use strict';

import * as path from "path";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import * as jbossConst from "./JbossConstants";
import { ServerState } from "../Constants";
import { Utility } from "../Utility";
import * as child_process from "child_process";

export class JbossServer extends vscode.TreeItem implements vscode.QuickPickItem {
    public needRestart: boolean = false;
    public label: string;
    public description: string;
    public jvmOptions: string[];
    public jvmOptionFile: string;
    public name:string;
    public home:string;
    public java_home:string;
    public java_process:child_process.ChildProcess;
    private _state: ServerState = ServerState.IdleServer;
    private _isDebugging: boolean = false;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;
    private _configurationPath: string;

    constructor(private _name: string, private _installPath: string, private _storagePath: string) {
        super(_name);
        this.label = _name;
        this.name=_name;
        this.home = _installPath;
        //this.java_home
        let t=vscode.workspace.getConfiguration();
        if(t.java ==undefined)
        {
            throw new Error('Java not enable, please install java extension and configure java.home');
        }
        this.java_home=t.java.home;
        this.jvmOptionFile = path.join(this._storagePath, Constants.JVM_OPTION_FILE);
        
        this._configurationPath = path.join(this._storagePath, jbossConst.JBOSS_STANDALONE_CONF_DIR, jbossConst.JBOSS_STANDALONE_CONF_XML);
    }

    public setDebugInfo(debugging: boolean, port: number, workspace: vscode.WorkspaceFolder): void {
        this._isDebugging = debugging;
        this._debugPort = port;
        this._debugWorkspace = workspace;
    }

    public clearDebugInfo(): void {
        this._isDebugging = false;
        this._debugPort = undefined;
        this._debugWorkspace = undefined;
    }

    public getDebugPort(): number {
        return this._debugPort;
    }

    public getDebugWorkspace(): vscode.WorkspaceFolder {
        return this._debugWorkspace;
    }

    public isDebugging(): boolean {
        return this._isDebugging;
    }

    public setStarted(started: boolean): void {
        this._state = started ? ServerState.RunningServer : ServerState.IdleServer;
        vscode.commands.executeCommand('jboss.tree.refresh');
    }

    public isStarted(): boolean {
        return this._state === ServerState.RunningServer;
    }

    public getState() : string {
        return this._state;
    }

    public getName(): string {
        return this._name;
    }

    public rename(newName: string): void {
        this._name = newName;
        this.label = newName;
    }

    public getInstallPath(): string {
        return this._installPath;
    }

    public getServerConfigPath(): string {
        return this._configurationPath;
    }

    public getStoragePath(): string {
        return this._storagePath;
    }
}
