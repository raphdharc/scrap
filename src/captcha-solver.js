const Captcha = require("2captcha");
const fs = require("fs");
const path = require("path");

async function solveCaptcha(apiKey, imagePath) {
  console.log("Attempting to solve captcha...");
  const solver = new Captcha.Solver(apiKey);
  try {
    const result = await solver.imageCaptcha(fs.readFileSync(imagePath));
    console.log("Captcha solved:", result.data);
    return result.data;
  } catch (error) {
    console.error("Error solving captcha:", error.message);
    return null;
  }
}

module.exports = { solveCaptcha };