'use strict';

export const HTTP: string = 'HTTP/';

export const CATALINA: string = 'Catalina';

export const INVALID_SERVER_DIRECTORY: string = 'Please make sure you select a valid Jboss Directory.';

// tslint:disable-next-line:no-http-string
export const UNABLE_SHUTDOWN_URL: string = 'https://stackoverflow.com/questions/36566401/severe-could-not-contact-localhost8005-jboss-may-not-be-running-error-while/48636631#48636631';

export const RESTART_CONFIG_ID: string = 'restart_when_http(s)_port_change';

// tslint:disable-next-line:no-http-string
export const LOCALHOST: string = 'http://localhost';

export const JVM_OPTION_FILE: string = 'jvm.options';

export const DEBUG_ARGUMENT_KEY: string = '-agentlib:jdwp=transport=dt_socket,suspend=n,server=y,address=localhost:';

export const CLASS_PATH_KEY: string = '-classpath';

export const JBOSS_BASE_KEY: string = '-Djboss.server.base.dir';

export const JBOSS_HOME_KEY: string = '-Djboss.home.dir';

export const JAVA_IO_TEMP_DIR_KEY: string = '-Djava.io.tmpdir';

export const ENCODING: string = '-Dfile.encoding=UTF8';

export const BOOTSTRAP_FILE: string = 'org.jboss.modules.Main';

export const WAR_FILE_EXTENSION: string = '.war';

export const JVM_DEFAULT_OPTIONS_KEYS: string[] = [CLASS_PATH_KEY, JBOSS_BASE_KEY, JBOSS_HOME_KEY];

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export enum PortKind {
    Server = 'Server',
    Http = 'http',
    Https = 'https'
}
