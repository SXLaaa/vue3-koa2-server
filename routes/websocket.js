const WebSocket = require('ws');
const OpenAI = require("openai");

// 初始化 DeepSeek 客户端
const deepSeekClient = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-26ca00a3f31d4c2283842b103bc33f97'
});

// 初始化阿里云通义千问客户端
const tongyiClient = new OpenAI({
  // apiKey: process.env.DASHSCOPE_API_KEY,
  apiKey: "sk-33990e54c1704d13a1ab20a0e2073019",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// 创建 WebSocket 服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  // 处理 WebSocket 连接
  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (message) => {
      let userMessage
      try {
        userMessage = JSON.parse(message);
        console.log('尝试调用DeepSeek API...'); // 添加日志输出
        // 调用 DeepSeek API 获取回复
        const deepSeekCompletion = await deepSeekClient.chat.completions.create({
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            userMessage
          ],
          model: "deepseek-chat",
        });

        const deepSeekResponse = {
          role: 'assistant',
          content: deepSeekCompletion.choices[0].message.content
        };
        ws.send(JSON.stringify(deepSeekResponse));
      } catch (deepSeekError) {
        console.log('尝试调用阿里云通义千问 API...'); // 添加日志输出
        try {
          // 尝试调用阿里云通义千问 API
          const tongyiCompletion = await tongyiClient.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              {
                role: userMessage.role,
                content: userMessage.content
              }
            ],
          });

          const tongyiResponse = {
            role: 'assistant',
            content: tongyiCompletion.choices[0].message.content
          };
          ws.send(JSON.stringify(tongyiResponse));
        } catch (tongyiError) {
          const errorResponse = {
            role: 'assistant',
            content: '抱歉，处理消息时出现错误。'
          };
          ws.send(JSON.stringify(errorResponse));
        }
      }
    });

    ws.on('close', () => {
      console.log('websocket 连接关闭');
    });
  });

  // 将 WebSocket 集成到 HTTP 服务器
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return wss;
};

module.exports = {
  createWebSocketServer
};