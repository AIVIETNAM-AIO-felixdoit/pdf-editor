import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api",
});

export const extractText = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/extract/text", form);
};

export const extractImages = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/extract/images", form);
};

export const mergePdfs = (files) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return API.post("/merge-split/merge", form, { responseType: "blob" });
};

export const splitPdf = (file, start, end) => {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ start });
  if (end !== undefined && end !== "") params.append("end", end);
  return API.post(`/merge-split/split?${params}`, form, { responseType: "blob" });
};

export const compressPdf = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/compress", form, { responseType: "blob" });
};

export const addHyperlink = (file, page, url, x, y, width, height) => {
  const form = new FormData();
  form.append("file", file);
  form.append("page", page);
  form.append("url", url);
  form.append("x", x);
  form.append("y", y);
  form.append("width", width);
  form.append("height", height);
  return API.post("/hyperlink/add", form, { responseType: "blob" });
};