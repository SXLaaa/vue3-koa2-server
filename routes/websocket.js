const WebSocket = require("ws");
const OpenAI = require("openai");

let localAiConfig = {};
try {
  localAiConfig = require("../config/ai.local");
} catch (error) {
  localAiConfig = {};
}

const deepSeekApiKey =
  process.env.DEEPSEEK_API_KEY || localAiConfig.deepSeekApiKey;
const dashscopeApiKey =
  process.env.DASHSCOPE_API_KEY || localAiConfig.dashscopeApiKey;

const deepSeekClient = deepSeekApiKey
  ? new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: deepSeekApiKey,
    })
  : null;

const tongyiClient = dashscopeApiKey
  ? new OpenAI({
      apiKey: dashscopeApiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    })
  : null;

if (!deepSeekClient) {
  console.warn("DEEPSEEK_API_KEY 未配置，DeepSeek 能力已禁用");
}

if (!tongyiClient) {
  console.warn("DASHSCOPE_API_KEY 未配置，通义千问回退能力已禁用");
}

// 创建 WebSocket 服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  // 处理 WebSocket 连接
  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", async (message) => {
      let userMessage;
      try {
        userMessage = JSON.parse(message);
        if (!userMessage || !userMessage.content) {
          throw new Error("Invalid user message");
        }

        if (deepSeekClient) {
          console.log("尝试调用DeepSeek API...");
          const deepSeekCompletion =
            await deepSeekClient.chat.completions.create({
              messages: [
                { role: "system", content: "You are a helpful assistant." },
                userMessage,
              ],
              model: "deepseek-chat",
            });

          const deepSeekResponse = {
            role: "assistant",
            content: deepSeekCompletion.choices[0].message.content,
          };
          ws.send(JSON.stringify(deepSeekResponse));
          return;
        }

        throw new Error("DeepSeek client unavailable");
      } catch (deepSeekError) {
        console.log("尝试调用阿里云通义千问 API...");
        try {
          if (!tongyiClient) {
            throw new Error("Tongyi client unavailable");
          }

          const tongyiCompletion = await tongyiClient.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              {
                role: userMessage.role,
                content: userMessage.content,
              },
            ],
          });

          const tongyiResponse = {
            role: "assistant",
            content: tongyiCompletion.choices[0].message.content,
          };
          ws.send(JSON.stringify(tongyiResponse));
        } catch (tongyiError) {
          const errorResponse = {
            role: "assistant",
            content:
              "抱歉，AI 服务当前不可用，请检查 DEEPSEEK_API_KEY 或 DASHSCOPE_API_KEY 配置。",
          };
          ws.send(JSON.stringify(errorResponse));
        }
      }
    });

    ws.on("close", () => {
      console.log("websocket 连接关闭");
    });

    ws.on("error", (error) => {
      console.error("WebSocket connection error:", error.message);
    });
  });

  // 将 WebSocket 集成到 HTTP 服务器
  server.on("upgrade", (request, socket, head) => {
    const { url = "" } = request;

    socket.on("error", (error) => {
      // 浏览器主动中断握手时，避免未捕获异常导致进程退出
      console.error("Upgrade socket error:", error.message);
    });

    if (!url.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  return wss;
};

module.exports = {
  createWebSocketServer
};
