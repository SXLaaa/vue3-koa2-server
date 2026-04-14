const WebSocket = require("ws");
const OpenAI = require("openai");

let localAiConfig = {};
try {
  localAiConfig = require("../config/ai.local.js");
} catch (error) {
  localAiConfig = {};
}

const deepSeekApiKey =
  process.env.DEEPSEEK_API_KEY || localAiConfig.deepSeekApiKey;
const openAiApiKey =
  process.env.OPENAI_API_KEY ||
  localAiConfig.openAiApiKey ||
  localAiConfig.openaiApiKey;
const dashscopeApiKey =
  process.env.DASHSCOPE_API_KEY || localAiConfig.dashscopeApiKey;

const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const openAiModel =
  process.env.OPENAI_MODEL ||
  localAiConfig.openAiModel ||
  localAiConfig.openaiModel ||
  "gpt-4o-mini";
const tongyiModel = process.env.DASHSCOPE_MODEL || "qwen-plus";

const deepSeekClient = deepSeekApiKey
  ? new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: deepSeekApiKey,
    })
  : null;

const openAiClient = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
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

if (!openAiClient) {
  console.warn("OPENAI_API_KEY 未配置，GPT Plus 能力已禁用");
}

if (!tongyiClient) {
  console.warn("DASHSCOPE_API_KEY 未配置，通义千问回退能力已禁用");
}

async function requestByProvider(provider, normalizedUserMessage) {
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    normalizedUserMessage,
  ];

  if (provider === "deepseek") {
    if (!deepSeekClient) throw new Error("DeepSeek client unavailable");
    const completion = await deepSeekClient.chat.completions.create({
      messages,
      model: deepSeekModel,
    });
    return {
      role: "assistant",
      content: completion.choices[0].message.content,
      modelType: "deepseek",
    };
  }

  if (provider === "openai") {
    if (!openAiClient) throw new Error("OpenAI client unavailable");
    const completion = await openAiClient.chat.completions.create({
      messages,
      model: openAiModel,
    });
    return {
      role: "assistant",
      content: completion.choices[0].message.content,
      modelType: "openai",
    };
  }

  if (provider === "tongyi") {
    if (!tongyiClient) throw new Error("Tongyi client unavailable");
    const completion = await tongyiClient.chat.completions.create({
      messages,
      model: tongyiModel,
    });
    return {
      role: "assistant",
      content: completion.choices[0].message.content,
      modelType: "tongyi",
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function getProviderChain(modelType) {
  if (modelType === "openai") {
    return ["openai", "deepseek", "tongyi"];
  }
  return ["deepseek", "openai", "tongyi"];
}

// 创建 WebSocket 服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", async (message) => {
      try {
        const userMessage = JSON.parse(message);
        if (!userMessage || !userMessage.content) {
          throw new Error("Invalid user message");
        }

        const normalizedUserMessage = {
          role: userMessage.role || "user",
          content: userMessage.content,
        };
        const preferredModelType = userMessage.modelType || "deepseek";
        const providers = getProviderChain(preferredModelType);

        for (const provider of providers) {
          try {
            const response = await requestByProvider(
              provider,
              normalizedUserMessage
            );
            ws.send(JSON.stringify(response));
            return;
          } catch (error) {
            console.error(`[${provider}] 调用失败:`, error.message);
          }
        }

        ws.send(
          JSON.stringify({
            role: "assistant",
            content:
              "抱歉，AI 服务当前不可用，请检查 OPENAI_API_KEY / DEEPSEEK_API_KEY / DASHSCOPE_API_KEY 配置。",
            modelType: "system",
          })
        );
      } catch (error) {
        ws.send(
          JSON.stringify({
            role: "assistant",
            content: "请求格式错误，请稍后重试。",
            modelType: "system",
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("websocket 连接关闭");
    });

    ws.on("error", (error) => {
      console.error("WebSocket connection error:", error.message);
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const { url = "" } = request;

    socket.on("error", (error) => {
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
  createWebSocketServer,
};
