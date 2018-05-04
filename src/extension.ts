'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import { Session, TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';
import { JbossController } from "./Jboss/JbossController";
import { JbossModel } from "./Jboss/JbossModel";
import { JbossServer } from "./Jboss/JbossServer";
import { WarPackage } from "./Jboss/WarPackage";
import { JbossSeverTreeProvider } from "./JbossSeverTreeProvider";
import { Utility } from "./Utility";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    let storagePath: string = context.storagePath;
    await TelemetryWrapper.initilizeFromJsonFile(context.asAbsolutePath('package.json'));
    if (!storagePath) {
        storagePath = Utility.getTempStoragePath();
    }
    const jbossModel: JbossModel = new JbossModel(storagePath);
    const jbossServerTree: JbossSeverTreeProvider = new JbossSeverTreeProvider(context, jbossModel);
    const jbossController: JbossController = new JbossController(jbossModel, context.extensionPath);

    context.subscriptions.push(jbossController);
    context.subscriptions.push(jbossServerTree);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('jbossServerExplorer', jbossServerTree));
    context.subscriptions.push(registerCommandWrapper('jboss.tree.refresh', (server: JbossServer) => jbossServerTree.refresh(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.war.browse', (war: WarPackage) => jbossController.browseWarPackage(war)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.rename', (server: JbossServer) => jbossController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.add', () => jbossController.addServer()));
    context.subscriptions.push(registerCommandWrapper('jboss.server.start', (server: JbossServer) => jbossController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.restart', (server: JbossServer) => jbossController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.stop', (server: JbossServer) => jbossController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.delete', (server: JbossServer) => jbossController.deleteServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.browse', (server: JbossServer) => jbossController.browseServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.debug', (server: JbossServer) => jbossController.runOrDebugOnServer(undefined, true, server)));
    context.subscriptions.push(registerCommandWrapper('jboss.war.run', (uri: vscode.Uri) => jbossController.runOrDebugOnServer(uri)));
    context.subscriptions.push(registerCommandWrapper('jboss.war.debug', (uri: vscode.Uri) => jbossController.runOrDebugOnServer(uri, true)));
    context.subscriptions.push(registerCommandWrapper('jboss.config.open', (server: JbossServer) => jbossController.openServerConfig(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.war.delete', (warPackage: WarPackage) => jbossController.deleteWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('jboss.war.reveal', (warPackage: WarPackage) => jbossController.revealWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.customizejvmoptions', (server: JbossServer) => jbossController.customizeJVMOptions(server)));

    // .context commands are duplicate for better naming the context commands and make it more clear and elegant
    context.subscriptions.push(registerCommandWrapper('jboss.server.rename.context', (server: JbossServer) => jbossController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.start.context', (server: JbossServer) => jbossController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.restart.context', (server: JbossServer) => jbossController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.stop.context', (server: JbossServer) => jbossController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('jboss.server.delete.context', (server: JbossServer) => jbossController.deleteServer(server)));
}

// tslint:disable no-any
function registerCommandWrapper(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    return TelemetryWrapper.registerCommand(command, (param: any[]) => {
        Utility.initTelemetrySteps();
        callback(param);
    });
}// tslint:enable no-any

// tslint:disable-next-line:no-empty
export function deactivate(): void {}
