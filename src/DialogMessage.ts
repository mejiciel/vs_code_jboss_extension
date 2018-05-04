'use strict';

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogMessage {
    export const yes: MessageItem = { title: localize('jbossExt.yes', 'Yes') };
    export const no: MessageItem = { title: localize('jbossExt.no', 'No'), isCloseAffordance: true };
    export const cancel: MessageItem = { title: localize('jbossExt.cancel', 'Cancel'), isCloseAffordance: true };
    export const never: MessageItem = { title: localize('jbossExt.never', 'Never') };
    export const moreInfo: MessageItem = { title: localize('jbossExt.moreInfo', 'More Info') };
    export const selectServer: string = localize('jbossExt.selectServer', 'Select Jboss Server');
    export const addServer: string = localize('jbossExt.addServer', 'Add New Server');
    export const noServer: string = localize('jbossExt.noServer', 'There are no Jboss Servers.');
    export const noPackage: string = localize('jbossExt.noPackage', 'The selected package is not under current workspace.');
    export const noServerConfig: string = localize('jbossExt.noServerConfig', 'The Jboss Server is broken. It does not have server.xml');
    export const selectWarPackage: string = localize('jbossExt.selectWarPackage', 'Select War Package');
    export const selectDirectory: string = localize('jbossExt.selectDirectory', 'Select Jboss Directory');
    export const deleteConfirm: string = localize('jbossExt.deleteConfirm', 'This Jboss Server is running, are you sure you want to delete it?');
    export const serverRunning: string = localize('jbossExt.serverRunning', 'This Jboss Server is already started.');
    export const serverStopped: string = localize('jbossExt.serverStopped', 'This Jboss Server was stopped.');
    export const startServer: string = localize('jbossExt.startServer', 'The Jboss server needs to be started before browsing. Would you like to start it now?');

    export function getServerPortChangeErrorMessage(serverName: string, serverPort: string): string {
        return localize('jbossExt.serverPortChangeError', 'Changing the server port of a running server {0} will cause it unable to shutdown. Would you like to change it back to {1}?', serverName, serverPort);
    }
    export function getConfigChangedMessage(serverName: string): string {
        return localize('jbossExt.configChanged', 'server.xml of running server {0} has been changed. Would you like to restart it?', serverName);
    }
}
