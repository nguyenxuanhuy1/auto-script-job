const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processToken = async (tokenName, tokenValue) => {
  if (!tokenValue) {
    console.log(`[${tokenName}] Không tìm thấy giá trị token, bỏ qua...`);
    return;
  }

  const END_HOUR = 16; // 16:00 (4h chiều)
  let failCount = 0;
  const MAX_FAILS = 5; // Số lần lỗi liên tiếp thì thoát

  while (true) {
    const now = new Date();
    if (now.getHours() >= END_HOUR) {
      console.log(`[${tokenName}] Đã đến 16:00 chiều. Dừng tiến trình!`);
      break;
    }

    try {
      console.log(`[${now.toLocaleTimeString()}] [${tokenName}] Bắn request nhận số...`);
      const res = await fetch('https://api-place.fpt.com/api/graphql', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-tenant-id': 'FPT',
          'authorization': `Bearer ${tokenValue}`
        },
        body: JSON.stringify({
          query: `mutation useJackpotBlastReceiveMutation {
            receiveLuckyNumber {
              number
              program {
                enabled
                maxSlots
                receivedNumbers
                cooldownRemainingSeconds
              }
            }
          }`,
          variables: {}
        })
      });

      const data = await res.json();
      let waitSeconds = 5;

      if (data?.data?.receiveLuckyNumber?.program) {
        const prog = data.data.receiveLuckyNumber.program;

        // Nếu chương trình chưa bật trên server
        if (prog.enabled === false) {
          console.log(`[${tokenName}] ⚠️ Chương trình đang tắt (enabled: false). Thoát script luôn để tránh loop!`);
          return;
        }

        failCount = 0;
        const currentNum = data.data.receiveLuckyNumber.number;
        const received = prog.receivedNumbers?.length || 0;
        const max = prog.maxSlots || 10;

        console.log(`[${tokenName}] 🎉 Thành công! Số nhận: ${currentNum} | Tiến độ: ${received}/${max}`);

        if (received >= max) {
          console.log(`[${tokenName}] 🏁 Đã nhận đủ tối đa ${max} số. Dừng tiến trình!`);
          break;
        }
        waitSeconds = (prog.cooldownRemainingSeconds || 2700) + 2;
      } 
      else if (data?.errors?.[0]?.message) {
        const msg = data.errors[0].message;
        const match = msg.match(/remaining seconds:\s*(\d+)/);
        if (match && match[1]) {
          waitSeconds = parseInt(match[1], 10) + 2;
        } else {
          failCount++;
          waitSeconds = 15;
          console.warn(`[${tokenName}] ⚠️ Lỗi phản hồi: ${msg}`);
        }
      }

      if (failCount >= MAX_FAILS) {
        console.log(`[${tokenName}] 🛑 Thất bại liên tiếp ${MAX_FAILS} lần (có thể server chưa mở). Thoát script!`);
        break;
      }

      console.log(`[${tokenName}] Chờ ${waitSeconds} giây trước khi gọi tiếp...`);
      await sleep(waitSeconds * 1000);

    } catch (e) {
      failCount++;
      console.error(`[${tokenName}] Lỗi kết nối (Lần ${failCount}/${MAX_FAILS}):`, e);
      if (failCount >= MAX_FAILS) {
        console.log(`[${tokenName}] 🛑 Lỗi kết nối liên tục, dừng script.`);
        break;
      }
      await sleep(10000);
    }
  }
};

async function main() {
  // Lấy danh sách token từ các GitHub Secrets đã tạo: HUY, LINH, OANH
  const tokenKeys = ['HUY', 'LINH', 'OANH'];
  const tasks = tokenKeys.map((name) => processToken(name, process.env[name]));

  console.log(`🚀 Bắt đầu chạy tự động cho các token: ${tokenKeys.join(', ')}...`);
  await Promise.all(tasks);
  console.log("🏁 Hoàn tất toàn bộ tiến trình!");
}

main();
