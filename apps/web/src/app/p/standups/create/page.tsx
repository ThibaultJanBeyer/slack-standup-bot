"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Form from "@radix-ui/react-form";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import * as zod from "zod";

import { Button } from "@ssb/ui/button";
import { Input } from "@ssb/ui/input";

import { NewStandup } from "@/lib/orm";

type Data = {
  slackId: string;
  name: string;
};
type Users = {
  users: { slackId: string; name: string }[];
};

type MembersOption = {
  name: string;
  id: string;
};

async function getChannels(id?: string): Promise<Data[]> {
  const res = await fetch(`/api/p/slack/channels?slackId=${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch data");
  const data: { channels: Data[] } = await res.json();
  return data.channels;
}
async function getUsers(id?: string, channelId?: string): Promise<Data[]> {
  const res = await fetch(
    `/api/p/slack/users-by-channel?slackId=${id}&channelId=${channelId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error("Failed to fetch data");
  const data: { users: Data[] } = await res.json();
  return data.users;
}

const schema = zod
  .object({
    name: zod.string().nonempty({ message: "Name is required" }),
    channelId: zod.string().nonempty({ message: "Channel ID is required" }),
    members: zod
      .array(zod.string())
      .nonempty({ message: "Members are required" }),
    scheduleCron: zod
      .string()
      .nonempty({ message: "Schedule cron is required" }),
    summaryCron: zod.string().nonempty({ message: "Summary cron is required" }),
  })
  .strict();

export default () => {
  const { user } = useUser();
  const [channels, setChannels] = useState<Data[]>([]);
  const [users, setUsers] = useState<Data[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onChange",
  });
  const selectedChannel = watch("channelId");

  // unfortunately useUser create an infinite loop on async components, so we need to use useEffect
  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getChannels(user.externalAccounts[0].providerUserId);
      setChannels(data);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedChannel) return;
    (async () => {
      const data = await getUsers(
        user.externalAccounts[0].providerUserId,
        selectedChannel,
      );
      setUsers(data);
    })();
  }, [user, selectedChannel]);

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    console.log(data);

    const newStandup: Omit<NewStandup, "workspaceId"> = {
      name: data.name,
      channelId: data.channelId,
      scheduleCron: data.scheduleCron,
      summaryCron: data.summaryCron,
      authorId: user!.externalAccounts[0].providerUserId,
      members: data.members,
    };

    fetch("/api/p/standups/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(newStandup),
    }).catch((err) => {
      console.log(err);
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Form.Root onSubmit={handleSubmit(onSubmit)}>
        <Form.Field name="name" className="mb-5">
          <Form.Label>Name</Form.Label>
          {Boolean(errors.name?.message) && (
            <Form.Message className="text-red-600">
              {`(${errors.name?.message})`}
            </Form.Message>
          )}
          <Form.Control asChild>
            <Input {...register("name")} />
          </Form.Control>
        </Form.Field>
        <Form.Field name="channelId" className="mb-5">
          <Form.Label>Channel ID</Form.Label>
          {Boolean(errors.channelId?.message) && (
            <Form.Message className="text-red-600">
              {`(${errors.channelId?.message})`}
            </Form.Message>
          )}
          <Form.Control asChild>
            <select
              {...register("channelId")}
              className="block w-full rounded-md border-2 border-solid border-gray-300 p-3"
            >
              <option key={""} value={""}>
                Select a channel
              </option>
              {channels.map((channel) => (
                <option key={channel.slackId} value={channel.slackId}>
                  {channel.name}
                </option>
              ))}
            </select>
          </Form.Control>
        </Form.Field>
        <Form.Field name="members" className="mb-5">
          <Form.Label>Select users to participate in this standup</Form.Label>
          {Boolean(errors.members?.message) && (
            <Form.Message className="text-red-600">
              {`(${errors.members?.message})`}
            </Form.Message>
          )}
          {!users.length ? (
            <div>
              <em>Select a channel first!</em>
            </div>
          ) : (
            <Form.Control asChild>
              <select
                {...register("members")}
                multiple
                className="block w-full rounded-md border-2 border-solid border-gray-300 p-3"
              >
                {users.map((user) => (
                  <option key={user.slackId} value={user.slackId}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Form.Control>
          )}
        </Form.Field>
        <Form.Field name="scheduleCron" className="mb-5">
          <Form.Label>
            Cron expression to start the questionnaire (in UTC):
          </Form.Label>
          {Boolean(errors.scheduleCron?.message) && (
            <Form.Message className="text-red-600">
              {`(${errors.scheduleCron?.message})`}
            </Form.Message>
          )}
          <Form.Control asChild>
            <Input {...register("scheduleCron")} defaultValue="0 7 * * 1-5" />
          </Form.Control>
        </Form.Field>
        <Form.Field name="summaryCron" className="mb-5">
          <Form.Label>Cron expression to send the summary (in UTC):</Form.Label>
          {Boolean(errors.summaryCron?.message) && (
            <Form.Message className="text-red-600">
              {`(${errors.summaryCron?.message})`}
            </Form.Message>
          )}
          <Form.Control asChild>
            <Input {...register("summaryCron")} defaultValue="0 11 * * 1-5" />
          </Form.Control>
        </Form.Field>
        <Form.Submit asChild>
          <Button type="submit">Create Standup</Button>
        </Form.Submit>
      </Form.Root>
    </main>
  );
};
