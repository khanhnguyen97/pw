const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");

function getWebHost(callback) {
    const cmd = os.platform() === 'win32' ? 'set' : 'printenv';
    exec(cmd, (error, stdout, stderr) => {
        if (error || stderr) {
            console.error("Lỗi khi chạy printenv:", error || stderr);
            return callback(null);
        }

        const line = stdout.split('\n').find(line => line.startsWith('WEB_HOST='));
        if (line) {
            const host = line.split("=")[1].trim();
            return callback(host);
        } else {
            console.log("WEB_HOST không được tìm thấy, tiếp tục tìm...");
            setTimeout(() => getWebHost(callback), 5000);
        }
    });
}


function saveTextToJsonFile(url) {
    const filePath = path.join(__dirname, 'urls.json');
    const dataToSave = [[url]];

    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        console.log('✔ Đã ghi đè urls.json');
    } catch (err) {
        console.error('❌ Lỗi ghi file:', err);
    }
}

// Khởi động
function start() {
    getWebHost((webHost) => {
        if (!webHost) {
            console.error("Không thể lấy WEB_HOST. Sẽ thử lại sau 5 giây...");
            return setTimeout(start, 5000); // tự gọi lại nếu lỗi
        }

        const url = "8080-" + webHost;
        console.log("URL đã được tạo:", url);
        saveTextToJsonFile(url);
    });
}

start(); // bắt đầu từ đây
