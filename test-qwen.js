
import { explainError } from "./src/api.js";

async function run() {
  try {
    const res = await explainError("gcc.exe: error: hello.c: No such file or directory\ngcc.exe: fatal error: no input files\ncompilation terminated.", "", "C", "English");
    console.log("----- RAW RESPONSE -----");
    console.log(res);
    console.log("------------------------");
  } catch (err) {
    console.error(err);
  }
}
run();

