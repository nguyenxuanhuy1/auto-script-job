const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processToken = async (tokenName, tokenValue) => {
  if (!tokenValue) {
    console.log(`[${tokenName}] Không có token, bỏ qua.`);
    return;
  }

  // Cho phép retry tối đa 2 lần trong 1 lượt chạy nếu gặp lỗi nhẹ
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      console.log(`[${tokenName}] Đang kiểm tra trạng thái...`);
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

      if (data?.data?.receiveLuckyNumber?.program) {
        const prog = data.data.receiveLuckyNumber.program;

        if (prog.enabled === false) {
          console.log(`[${tokenName}] ⚠️ Chương trình đang tắt.`);
          return;
        }

        const currentNum = data.data.receiveLuckyNumber.number;
        const received = prog.receivedNumbers?.length || 0;
        const max = prog.maxSlots || 10;

        if (received >= max) {
          console.log(`[${tokenName}] ✅ Đã nhận đủ tối đa ${max} số.`);
          return;
        }

        if (currentNum) {
          console.log(`[${tokenName}] 🎉 Nhận thành công số: ${currentNum} | Tiến độ: ${received}/${max}`);
          return;
        }

        // Nếu chưa có số nhưng server trả về thời gian cooldown còn lại
        const cooldown = prog.cooldownRemainingSeconds || 0;
        if (cooldown > 0 && cooldown <= 180) {
          // Nếu cooldown còn rất ngắn (<= 3 phút), đứng đợi luôn rồi gọi lại ngay!
          console.log(`[${tokenName}] ⏳ Cooldown ngắn (${cooldown}s), đang đợi để lấy luôn...`);
          await sleep((cooldown + 2) * 1000);
          attempts++;
          continue; // Vòng lặp retry gọi lại ngay
        } else {
          console.log(`[${tokenName}] ⏳ Đang cooldown (${Math.round(cooldown / 60)} phút nữa). Để lượt quét sau lấy.`);
          return;
        }
      } 
      else if (data?.errors && data.errors.length > 0) {
        const msg = data.errors[0].message || '';
        const match = msg.match(/remaining seconds:\s*(\d+)/i);
        if (match && match[1]) {
          const cd = parseInt(match[1], 10);
          if (cd <= 180) {
            console.log(`[${tokenName}] ⏳ Cooldown ngắn từ lỗi (${cd}s), đợi lấy luôn...`);
            await sleep((cd + 2) * 1000);
            attempts++;
            continue;
          }
        }
        console.log(`[${tokenName}] ℹ️ ${msg}`);
        return;
      } 
      else {
        console.log(`[${tokenName}] Phản hồi khác:`, JSON.stringify(data));
        return;
      }

    } catch (e) {
      attempts++;
      console.error(`[${tokenName}] Lỗi kết nối (thử lại lần ${attempts}):`, e.message);
      await sleep(3000);
    }
  }
};

async function main() {
  const tokenKeys = ['HUY', 'LINH', 'OANH'];
  console.log(`Bắt đầu quét lượt nhận số cho: ${tokenKeys.join(', ')}...`);
  
  for (const name of tokenKeys) {
    await processToken(name, process.env[name]);
  }

  console.log("Hoàn tất lượt quét này!");
}

main();
