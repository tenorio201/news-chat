const https=require("https");
const express = require('express');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const app = express();
const socketIo = require('socket.io');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/tenorio.games/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/tenorio.games/cert.pem')
};

const server = https.createServer(options,app);
const io=require("socket.io")(server);
const port = 3000;

// OpenAI APIの初期化（APIキーを設定してください）
const OpenAI = require("openai");
const openai = new OpenAI();
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('5c9eb055ef034d378853a6f7a495fd92');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  console.log('ユーザーが接続しました');

  socket.on('sendText', async (text) => {
    let result = ""; // 文字列として初期化

    newsapi.v2.everything({
      q: text,
      sortBy: 'publishedAt',
      page: 2
    }).then(async response => {
      for (let i = 0; i < response["articles"].length/2; i++) {
        result += "タイトル:" + JSON.stringify(response["articles"][i]["title"]) + "内容:" + JSON.stringify(response["articles"][i]["description"]);
      }

      // News APIからのレスポンスを受け取った後にOpenAI APIを呼び出す
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: "これはニュース記事を羅列したデータです。この中から興味深いものを3つピックアップし、要約してください。多言語のニュースがあるため、わかりやすい日本語に再構成してください。なお、選んだ根拠も示してください。：" + result }],
        model: "gpt-3.5-turbo",
      });

      let reply = completion.choices[0].message.content; // APIからの返答を使用

      // 1文字ずつクライアントに送信
      for (let i = 0; i < reply.length; i++) {
        setTimeout(() => {
          socket.emit('replyText', reply[i]);
        }, i * 10); // 10ミリ秒ごとに1文字ずつ送る
      }
    }).catch(error => {
      console.error("エラーが発生しました:", error);
    });
  });

  socket.on('disconnect', () => {
    console.log('ユーザーが切断しました');
  });
});

server.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しています`);
});

//https.createServer(options, app).listen(3000, function() {
  //console.log('HTTPS server listening on port 3000');
//});
