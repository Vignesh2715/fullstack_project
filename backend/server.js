// creating express server module based server we use es6 feature go to package.json and type=module

import express from "express";
import cors from "cors";

//app config

const app = express();
const port = 4000;

//middleware

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("API WORKING");
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
