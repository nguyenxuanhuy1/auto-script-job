const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processToken = async (tokenName, tokenValue) => {
  if (!tokenValue) {
    console.log(`[${tokenName}] Không tìm thấy giá trị token, bỏ qua.`);
    return;
  }

  const END_HOUR = 16; // 16:00 (4h chiều)
  let failCount = 0;
  const MAX_FAILS = 5; // Số lần lỗi liên tiếp thì thoát vòng lặp

  while (true) {
    const now = new Date();

    // Dừng nếu đã đến hoặc qua 16:00 chiều
    if (now.getHours() >= END_HOUR) {
      console.log(`[${tokenName}] 🏁 Đã đến 16:00 chiều. Dừng tiến trình!`);
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
      let waitSeconds = 15;

      if (data?.data?.receiveLuckyNumber?.program) {
        const prog = data.data.receiveLuckyNumber.program;

        // Nếu server trả về program.enabled = false (chưa bật chương trình)
        if (prog.enabled === false) {
          console.log(`[${tokenName}] ⚠️ Chương trình đang tắt (enabled: false). Thoát script để tránh loop!`);
          break;
        }

        failCount = 0; // Reset số lần lỗi
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
      else if (data?.errors && data.errors.length > 0) {
        const msg = data.errors[0].message || '';
        console.warn(`[${tokenName}] ⚠️ API báo lỗi: ${msg}`);
        const match = msg.match(/remaining seconds:\s*(\d+)/i);
        if (match && match[1]) {
          waitSeconds = parseInt(match[1], 10) + 2;
        } else {
          failCount++;
          waitSeconds = 15;
        }
      } 
      else {
        // Phản hồi không đúng định dạng mong đợi
        failCount++;
        console.warn(`[${tokenName}] ⚠️ Phản hồi lạ từ server:`, JSON.stringify(data));
        waitSeconds = 15;
      }

      // Nếu thất bại liên tiếp quá MAX_FAILS lần thì thoát
      if (failCount >= MAX_FAILS) {
        console.log(`[${tokenName}] 🛑 Thất bại liên tiếp ${MAX_FAILS} lần (có thể server chưa mở). Thoát script!`);
        break;
      }

      console.log(`[${tokenName}] Chờ ${waitSeconds} giây trước khi gọi tiếp...`);
      await sleep(waitSeconds * 1000);

    } catch (e) {
      failCount++;
      console.error(`[${tokenName}] Lỗi kết nối (Lần ${failCount}/${MAX_FAILS}):`, e.message);
      if (failCount >= MAX_FAILS) {
        console.log(`[${tokenName}] 🛑 Lỗi kết nối liên tục, dừng script.`);
        break;
      }
      await sleep(10000);
    }
  }
};

async function main() {
  const tokenKeys = ['HUY', 'LINH', 'OANH'];
  const tasks = tokenKeys.map((name) => processToken(name, process.env[name]));

  console.log(`🚀 Bắt đầu chạy tự động cho các token: ${tokenKeys.join(', ')}...`);
  await Promise.all(tasks);
  console.log("🏁 Hoàn tất toàn bộ tiến trình!");
}

main();
