/**
 * CloudBase 鍙嶉闆嗗悎鍒濆鍖栬剼鏈? *
 * 鐢ㄩ€旓細
 *   1. 楠岃瘉 CloudBase 鐜鍙橀噺鏄惁閰嶇疆姝ｇ‘
 *   2. 鑷姩鍒涘缓 analysis_feedback 闆嗗悎锛堝涓嶅瓨鍦級
 *   3. 鍒涘缓甯哥敤鏌ヨ绱㈠紩
 *
 * 杩愯鏂瑰紡锛? *   cd frontend
 *   npx tsx scripts/init-cloudbase.ts
 *
 * 鎴栬€咃細
 *   node --import tsx scripts/init-cloudbase.ts
 */

import tcb from "@cloudbase/node-sdk";

const COLLECTION = process.env.CLOUDBASE_FEEDBACK_COLLECTION || "analysis_feedback";

function loadEnv() {
  // 鎵嬪姩璇诲彇 .env.local锛堜笉渚濊禆 dotenv锛?  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // ignore
  }
}

async function main() {
  loadEnv();

  const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV_ID;
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.TENCENT_SECRET_KEY;

  console.log("\n=== CloudBase 鍙嶉闆嗗悎鍒濆鍖?===\n");

  // 1. 妫€鏌ョ幆澧冨彉閲?  const missing: string[] = [];
  if (!envId) missing.push("CLOUDBASE_ENV_ID");
  if (!secretId) missing.push("TENCENTCLOUD_SECRETID");
  if (!secretKey) missing.push("TENCENTCLOUD_SECRETKEY");

  if (missing.length > 0) {
    console.error("鉂?鐜鍙橀噺缂哄け锛? + missing.join(", "));
    console.error("   璇峰湪 frontend/.env.local 涓厤缃悗閲嶈瘯銆俓n");
    process.exit(1);
  }

  console.log(`   鐜ID:   ${envId}`);
  console.log(`   SecretId: ${secretId!.slice(0, 8)}****${secretId!.slice(-4)}`);
  console.log(`   闆嗗悎鍚?   ${COLLECTION}\n`);

  // 2. 鍒濆鍖?SDK
  let app;
  try {
    app = tcb.init({ env: envId!, secretId: secretId!, secretKey: secretKey! });
    console.log("鉁?CloudBase SDK 鍒濆鍖栨垚鍔?);
  } catch (err) {
    console.error("鉂?CloudBase SDK 鍒濆鍖栧け璐ワ細", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const db = app.database();
  const collection = db.collection(COLLECTION);

  // 3. 妫€鏌ラ泦鍚堟槸鍚﹀凡鏈夋暟鎹?  let existingCount = 0;
  try {
    const countResult = await collection.count();
    existingCount = countResult.total || 0;
    console.log(`鉁?闆嗗悎銆?{COLLECTION}銆嶅凡瀛樺湪锛屽綋鍓嶆湁 ${existingCount} 鏉¤褰昤);
  } catch (err: unknown) {
    // 闆嗗悎涓嶅瓨鍦ㄦ椂 count 鍙兘鎶ラ敊锛屾彃鍏ヤ竴鏉℃枃妗ｅ嵆鍙嚜鍔ㄥ垱寤?    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not exist") || msg.includes("DATABASE_COLLECTION_NOT_EXIST") || msg.includes("涓嶅瓨鍦?)) {
      console.log(`鈿狅笍  闆嗗悎銆?{COLLECTION}銆嶅皻涓嶅瓨鍦紝灏嗚嚜鍔ㄥ垱寤衡€);
    } else {
      console.log(`鈩癸笍  闆嗗悎鏌ヨ杩斿洖锛?{msg}`);
      console.log(`   灏嗗皾璇曢€氳繃鎻掑叆鏂囨。鑷姩鍒涘缓闆嗗悎鈥);
    }
  }

  // 4. 濡傛灉闆嗗悎涓虹┖鎴栦笉瀛樺湪锛岀敤 createCollection 鍒涘缓
  if (existingCount === 0) {
    try {
      await db.createCollection(COLLECTION);
      console.log(`鉁?闆嗗悎銆?{COLLECTION}銆嶅凡鍒涘缓鎴愬姛`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exist") || msg.includes("宸插瓨鍦?)) {
        console.log(`鉁?闆嗗悎銆?{COLLECTION}銆嶅凡瀛樺湪`);
      } else {
        console.error("鉂?鍒涘缓闆嗗悎澶辫触锛?, msg);
        process.exit(1);
      }
    }
  }

  // 5. 鍒涘缓绱㈠紩锛堝彲閫夛紝澶辫触涓嶉樆濉烇級
  const indexes = [
    { name: "idx_createdAt", field: { createdAt: -1 } },
    { name: "idx_feedbackType", field: { feedbackType: 1 } },
    { name: "idx_contractId", field: { contractId: 1 } },
    { name: "idx_problemCategory", field: { problemCategory: 1 } }
  ];

  console.log("\n--- 鍒涘缓绱㈠紩 ---");
  for (const idx of indexes) {
    try {
      // CloudBase node-sdk 鐨?createIndex API
      // 娉ㄦ剰锛氫笉鍚岀増鏈?SDK API 鍙兘涓嶅悓锛岃繖閲屽仛瀹归敊
      await collection.createIndex(idx.name, idx.field as Record<string, number>);
      console.log(`鉁?绱㈠紩 ${idx.name} 鍒涘缓鎴愬姛`);
    } catch {
      // 绱㈠紩鍙兘宸插瓨鍦ㄦ垨 SDK 鐗堟湰涓嶆敮鎸侊紝蹇界暐
      console.log(`鈩癸笍  绱㈠紩 ${idx.name} 璺宠繃锛堝彲鑳藉凡瀛樺湪鎴?SDK 涓嶆敮鎸侊級`);
    }
  }

  // 6. 鏈€缁堥獙璇?  try {
    const finalCount = await collection.count();
    console.log(`\n鉁?鍒濆鍖栧畬鎴愶紒闆嗗悎銆?{COLLECTION}銆嶅氨缁紝褰撳墠 ${finalCount.total || 0} 鏉¤褰曘€俙);
    console.log("\n涓嬩竴姝ワ細鍦ㄥ墠绔€屽弽棣堢鐞嗐€嶉〉闈㈡彁浜や竴鏉″弽棣堬紝鍗冲彲鍦ㄣ€屼簯绔€昏銆峊ab 鏌ョ湅銆俓n");
  } catch (err) {
    console.error("\n鈿狅笍  鏈€缁堥獙璇佸け璐ワ細", err instanceof Error ? err.message : err);
    console.error("   浣嗛泦鍚堝彲鑳藉凡鍒涘缓鎴愬姛锛岃鍒板墠绔祴璇曟彁浜ゅ弽棣堛€俓n");
  }
}

main().catch((err) => {
  console.error("\n鉂?鑴氭湰鎵ц鍑洪敊锛?, err);
  process.exit(1);
});
