import axios from "axios";

export const client = axios.create({ baseURL: "/api" });

export async function getConfig() {
  const { data } = await client.get("/config");
  return data;
}

export async function updateConfig(payload: any) {
  const { data } = await client.put("/config", payload);
  return data;
}

export async function createGeneration(payload: any) {
  const { data } = await client.post("/generations", payload);
  return data;
}

export async function deleteGeneration(id: string) {
  await client.delete(`/generations/${id}`);
}

export async function updateGeneration(id: string, payload: any) {
  const { data } = await client.put(`/generations/${id}`, payload);
  return data;
}

export async function uploadCover(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post(`/generations/${id}/cover`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteCover(id: string) {
  const { data } = await client.delete(`/generations/${id}/cover`);
  return data;
}

export async function regenerateCover(id: string) {
  const { data } = await client.post(`/generations/${id}/cover/regenerate`);
  return data;
}

export async function listHistory() {
  const { data } = await client.get("/history");
  return data;
}

export async function runLLMTask(payload: any) {
  const { data } = await client.post("/llm", payload);
  return data;
}

export async function listLLMModels(params?: { endpoint?: string; api_key?: string }) {
  const { data } = await client.get("/llm/models", { params });
  return data;
}

export async function listCheckpointModels() {
  const { data } = await client.get("/models");
  return data;
}

export async function downloadCheckpointModel(id: string) {
  const { data } = await client.post(`/models/${id}/download`);
  return data;
}
