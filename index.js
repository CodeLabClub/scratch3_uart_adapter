const ArgumentType = require("../../extension-support/argument-type");
const BlockType = require("../../extension-support/block-type");
const formatMessage = require("format-message");
const AdapterBaseClient = require("../scratch3_eim/codelab_adapter_base.js");

const FormHelp = {
    en: "help",
    "zh-cn": "帮助",
};

const Form_control_extension = {
    en: "[turn] [ext_name]",
    "zh-cn": "[turn] [ext_name]",
};

const Form_broadcastMessageAndWait_REPORTER = {
    en: "broadcast [content] and wait",
    "zh-cn": "广播[content]并等待",
};

const Form_sendMessageAndWait = {
    en: "broadcast [content] and wait",
    "zh-cn": "广播[content]并等待",
};

const Form_connect = {
    en: "connect port [port]",
    "zh-cn": "连接到 [port]",
};

const Form_write = {
    en: "writeline [content]",
    "zh-cn": "写入一行串口数据 [content]",
};

const Form_read = {
    en: "read",
    "zh-cn": "读取串口数据",
};

const Form_update_ports = {
    en: "update ports",
    "zh-cn": "更新串口信息",
};


const Form_port = {
    en: "port [port]",
    "zh-cn": "串口 [port]",
};



/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const blockIconURI = require("./icon_logo.png");
const menuIconURI = blockIconURI;

const NODE_ID = "eim/extension_uart_adapter";
const HELP_URL = "https://adapter.codelab.club/extension_guide/uart_adapter/";

class Client {
    onAdapterPluginMessage(msg) {
        this.node_id = msg.message.payload.node_id;
        if (
            this.node_id === this.NODE_ID ||
            this.node_id === "ExtensionManager"
        ) {
            this.adapter_node_content_hat = msg.message.payload.content;
            this.adapter_node_content_reporter = msg.message.payload.content;
            if(this.adapter_node_content_reporter && this.adapter_node_content_reporter.ports){
                this.ports = this.adapter_node_content_reporter.ports;
            }
        }
    }

    notify_callback(msg) {
        // 使用通知机制更新插件退出状态
        if (msg.message === `${this.NODE_ID} stopped`){
            this._UartAdapterBlocks.reset();
        }
    }

    constructor(node_id, help_url, _UartAdapterBlocks) {
        this.NODE_ID = node_id;
        this.HELP_URL = help_url;
        this._UartAdapterBlocks = _UartAdapterBlocks;
        

        this.adapter_base_client = new AdapterBaseClient(
            null, // onConnect,
            null, // onDisconnect,
            null, // onMessage,
            this.onAdapterPluginMessage.bind(this), // onAdapterPluginMessage,
            null, // update_nodes_status,
            null, // node_statu_change_callback,
            this.notify_callback.bind(this), // notify_callback,
            null, // error_message_callback,
            null // update_adapter_status
        );
    }

    formatPorts() {
        // text value list
        console.debug("ports -> ", this.ports)
        if (Array.isArray(this.ports) && this.ports.length) { // list
            // window.extensions_statu = this.exts_statu;
            let ports = this.ports.map(x => ({text:x, value:x}));
            return ports;
        }
        return [
            {
                text: "",
                value: "",
            },
        ];
    }

}

class UartAdapterBlocks {
    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this._runtime = runtime
        this.client = new Client(NODE_ID, HELP_URL, this); // this is UartAdapterBlocks
        this._runtime.registerPeripheralExtension('uartAdapter', this); // 主要使用UI runtime // uartAdapter 和 id 相同
    }

    start_extension(){
        const content = 'start';
        const ext_name = 'extension_uart_adapter';
        return this.client.adapter_base_client.emit_with_messageid_for_control(
            NODE_ID,
            content,
            ext_name,
            "extension"
        ).then(() => {
            console.log(`start ${ext_name}`)
        })
    }


    scan() {
        if (window.socketState !== undefined && !window.socketState) {
            this._runtime.emit(this._runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                message: `Codelab adapter 未连接`,
                extensionId: this.extensionId
            });
            return
        }
        let promise = Promise.resolve()

        //  自动打开插件
        promise = promise.then(() => {
            return this.start_extension()
        })


        const code = `serialHelper.update_ports()`; // 广播 , 收到特定信息更新变量
        promise.then(() => {
            return this.client.adapter_base_client.emit_with_messageid(
                NODE_ID,
                code
            )
        }).then(() => {
            let ports = this.client.formatPorts()
            let portsObj = ports
                .filter(port => !!port.value)
                .map(port => ({"name":port.value,"peripheralId": port.value,"rssi":-0}))
                .reduce((prev, curr) => {
                    prev[curr.peripheralId] = curr
                    return prev
                }, {})
            this._runtime.emit(
                this._runtime.constructor.PERIPHERAL_LIST_UPDATE,
                portsObj
            );
        }).catch(e => console.error(e))

        console.log("scan");
    }
    /**
     * Called by the runtime when user wants to connect to a certain peripheral.
     * @param {number} id - the id of the peripheral to connect to.
     */

    connect(id) {
        // UI 触发
        console.log(`ready to connect ${id}`);
        if (this.client) {
            const port = id;
            const code = `serialHelper.connect("${port}")`; // disconnect()
            console.log(`ready to send ${code}`)
            this.client.adapter_base_client.emit_with_messageid(
                NODE_ID,
                code
            ).then(() => {
                this.connected = true
                this._runtime.emit(this._runtime.constructor.PERIPHERAL_CONNECTED);
            })
        }
    }

    disconnect() {
        // todo: disconnect: `serialHelper.disconnect()`;
        this.reset();

        if (!this.client.adapter_base_client.connected) {
            return
        }

        const code = `serialHelper.disconnect()`; // disconnect()
        this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            code
        ).then((res) => {
            // 这个消息没有 resolve
           console.log(res)
        }).catch(e => console.error(e))
    }

    reset() {
        console.log("reset");
        this.connected = false
        this._runtime.emit(this._runtime.constructor.PERIPHERAL_DISCONNECTED);
        // 断开
    }

    isConnected() {
        let connected = false;
        if (this.client) {
            connected = this.client.adapter_base_client.connected && this.connected;
        }
        return connected;
    }

    /**
     * The key to load & store a target's test-related state.
     * @type {string}
     */
    static get STATE_KEY() {
        return "Scratch.uartAdapter";
    }

    _setLocale() {
        let now_locale = "";
        switch (formatMessage.setup().locale) {
            case "en":
                now_locale = "en";
                break;
            case "zh-cn":
                now_locale = "zh-cn";
                break;
            default:
                now_locale = "zh-cn";
                break;
        }
        return now_locale;
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo() {
        let the_locale = this._setLocale();
        return {
            id: "uartAdapter",
            name: "uartAdapter",
            menuIconURI: menuIconURI,
            blockIconURI: blockIconURI,
            showStatusButton: true,
            blocks: [
                {
                    opcode: "open_help_url",
                    blockType: BlockType.COMMAND,
                    text: FormHelp[the_locale],
                    arguments: {},
                },
                {
                    opcode: "control_extension",
                    blockType: BlockType.COMMAND,
                    text: Form_control_extension[the_locale],
                    arguments: {
                        turn: {
                            type: ArgumentType.STRING,
                            defaultValue: "start",
                            menu: "turn",
                        },
                        ext_name: {
                            type: ArgumentType.STRING,
                            defaultValue: "extension_uart_adapter",
                        },
                    },
                },
                // 更新串口信息 update ports
                {
                    opcode: "update_ports",
                    blockType: BlockType.COMMAND,
                    text: Form_update_ports[the_locale],
                    arguments: {
                    },
                },
                {
                    opcode: "get_port",
                    blockType: BlockType.REPORTER,
                    text: Form_port[the_locale],
                    arguments: {
                        port: {
                            type: ArgumentType.STRING,
                            defaultValue: "",
                            menu: "ports"
                        },
                    },
                },
                {
                    opcode: "connect_port",
                    blockType: BlockType.COMMAND,
                    text: Form_connect[the_locale],
                    arguments: {
                        port: {
                            type: ArgumentType.STRING,
                            defaultValue: "",
                            menu: "ports"
                        },
                    },
                },
                {
                    opcode: "write",
                    blockType: BlockType.COMMAND,
                    text: Form_write[the_locale],
                    arguments: {
                        content: {
                            type: ArgumentType.STRING,
                            defaultValue: "hello",
                        },
                    },
                },
                {
                    opcode: "read",
                    blockType: BlockType.REPORTER,
                    text: Form_read[the_locale],
                    arguments: {},
                },
                // discover all
                {
                    opcode: "broadcastMessageAndWait_REPORTER",
                    blockType: BlockType.REPORTER,
                    text: Form_broadcastMessageAndWait_REPORTER[the_locale],
                    arguments: {
                        content: {
                            type: ArgumentType.STRING,
                            defaultValue: "serialHelper.readline()",
                        },
                    },
                },
                {
                    opcode: "broadcastMessageAndWait",
                    blockType: BlockType.COMMAND,
                    text: Form_sendMessageAndWait[the_locale],
                    arguments: {
                        content: {
                            type: ArgumentType.STRING,
                            defaultValue: "serialHelper.write('a\\n')",
                        },
                    },
                },
            ],
            menus: {
                turn: {
                    acceptReporters: true,
                    items: ["start", "stop"],
                },
                ports: {
                    acceptReporters: true,
                    items: "_formatPorts",
                },
            },
        };
    }

    _formatPorts() {
        return this.client.formatPorts();
    }

    open_help_url(args) {
        window.open(HELP_URL);
    }

    control_extension(args) {
        const content = args.turn;
        const ext_name = args.ext_name;
        return this.client.adapter_base_client.emit_with_messageid_for_control(
            NODE_ID,
            content,
            ext_name,
            "extension"
        );
    }

    update_ports(args) {
        // 更新到一个变量里
        const code = `serialHelper.update_ports()`; // 广播 , 收到特定信息更新变量
        //this.socket.emit("actuator", { topic: TOPIC, payload: message });
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            code
        );
    }

    connect_port(args) {
        const port = args.port;
        const code = `serialHelper.connect("${port}")`;
        //this.socket.emit("actuator", { topic: TOPIC, payload: message });
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            code
        );
    }

    read(args) {
        let code = "serialHelper.readline()";
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            code
        );
    }

    write(args) {
        const content = args.content;
        const code = `serialHelper.write("${content}\\n")`; // \n new line
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            code
        );
    }

    broadcastMessageAndWait(args) {
        const content = args.content;
        //this.socket.emit("actuator", { topic: TOPIC, payload: message });
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            content
        );
    }

    broadcastMessageAndWait_REPORTER(args) {
        const content = args.content;
        return this.client.adapter_base_client.emit_with_messageid(
            NODE_ID,
            content
        );
    }

    get_port(args) {
        const port = args.port;
        return port;
    }


}

module.exports = UartAdapterBlocks;
