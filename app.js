const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Đọc tệp Base64
fs.readFile('khanh.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('Lỗi khi đọc tệp Base64:', err);
    return;
  }

  try {
    // Giải mã Base64
    const decodedData = Buffer.from(data, 'base64').toString('utf8');
    
    // Tạo context với require, setTimeout và các API của Node.js
    const context = vm.createContext({
      require: require,
      console: console,
      __dirname: __dirname,
      __filename: path.basename(__filename),
      process: process,
      setTimeout: setTimeout,    // Thêm setTimeout vào context
      clearTimeout: clearTimeout // Thêm clearTimeout vào context
    });

    // Chạy mã JavaScript trong context mới
    vm.runInContext(decodedData, context);

    console.log('Mã JavaScript đã được thực thi.');
  } catch (error) {
    console.error('Lỗi khi giải mã hoặc thực thi mã:', error);
  }
});
