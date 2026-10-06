import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let seed = 12345;
function random() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function getRandomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(getRandomInt(0, chars.length - 1));
  }
  return result;
}

const types = ["cpu", "gpu", "ram", "disk"];
const products = [];

for (let i = 1; i <= 100; i++) {
  const type = types[getRandomInt(0, types.length - 1)];
  const amount = i % 10 === 0 ? 0 : getRandomInt(1, 100);

  products.push({
    id: i,
    code: generateCode(),
    name: `Produkt ${type.toUpperCase()} Model ${i}`,
    type: type,
    price: getRandomInt(5000, 300000),
    amount: amount,
    description: `Świetnej jakości ${type} idealny do Twojego komputera.`,
    date: new Date(Date.now() - getRandomInt(0, 10000000000)).toISOString(),
    image: `/images/products/${type}.webp`,
  });
}

const targetPath = path.join(__dirname, "../lib/data.json");
fs.writeFileSync(targetPath, JSON.stringify(products, null, 2));
console.log(`Wygenerowano 100 produktów do pliku ${targetPath}`);
