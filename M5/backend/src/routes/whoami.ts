import type { Request, Response } from "express";

interface User {
  name: string;
  email: string;
  age: number;
}

export async function whoami(_req: Request, res: Response<User>) {
  return res.json({
    name: "Daniel Mulvad",
    email: "daniel@example.com",
    age: 25,
  });
}
