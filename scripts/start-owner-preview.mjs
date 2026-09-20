import {spawn} from 'node:child_process';
// Explicit local-only launcher. Does not collect data or change public configuration.
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','4198'],{stdio:'inherit',env:{...process.env,YANG_EDGE_OWNER_PREVIEW:'1'}});
child.on('exit',code=>{process.exitCode=code??1;});
