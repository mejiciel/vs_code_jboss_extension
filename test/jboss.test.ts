'use strict';

import * as assert from "assert";
import { DialogMessage } from '../src/DialogMessage';
import { JbossController } from "../src/Jboss/JbossController";
import { JbossModel } from "../src/Jboss/JbossModel";
import { JbossServer } from "../src/Jboss/JbossServer";
import { Utility } from "../src/Utility";

suite('Error input', () => {
  const serverInfo: JbossServer = undefined;
  const jbossModel: JbossController = new JbossController(new JbossModel(''), undefined);
  test('stopServer', async () => {
    try {
      await jbossModel.stopOrRestartServer(serverInfo);
      assert.fail('Resolve', 'Reject');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
  test('runOnServer', async () => {
    try {
      await jbossModel.runOrDebugOnServer(undefined);
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
});
