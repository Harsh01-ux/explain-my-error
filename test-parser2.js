
import { parseResponse } from "./src/api.js";
import fs from "fs";

const text = fs.readFileSync("qwen_output.txt", "utf-8");
console.log(parseResponse(text));

