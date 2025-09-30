export const tmaModeDescription: { [key: string]: string } = {
  test: "测试电子邮件地址",
  white: "管理白名单",
  block: "管理黑名单",
  mails: "查看邮件列表",
};

export const telegramCommands = [
  {
    command: "id",
    description: "/id - 获取您的聊天 ID",
  },
  {
    command: "mails",
    description: `/mails - ${tmaModeDescription.mails}`,
  },
  {
    command: "test",
    description: `/test - ${tmaModeDescription.test}`,
  },
  {
    command: "white",
    description: `/white - ${tmaModeDescription.white}`,
  },
  {
    command: "block",
    description: `/block - ${tmaModeDescription.block}`,
  },
];
