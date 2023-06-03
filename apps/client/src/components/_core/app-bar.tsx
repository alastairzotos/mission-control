import { HEADER_HEIGHT } from "@/components/_core/sizes";
import { useLoggedInUser, useLogout } from "@/plugins/user";
import { Button, Layout, Space, Typography, theme } from "antd";
import React from "react";

const { Header } = Layout;
const { Text } = Typography;

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  height: HEADER_HEIGHT,
  paddingInline: 50,
  lineHeight: '64px',
  zIndex: 10000,
};

export const AppBar: React.FC = () => {
  const handleLogout = useLogout();
  const loggedInUser = useLoggedInUser();

  const {
    token: { colorBgContainer, colorBorderSecondary },
  } = theme.useToken();

  return (
    <Header style={{ ...headerStyle, borderBottom: `1px solid ${colorBorderSecondary}` }}>
      {loggedInUser && (
        <div style={{ display: 'flex' }}>
          <Space>
            <Text>Logged in as {loggedInUser.email}</Text>
            <Button onClick={handleLogout}>Logout</Button>
          </Space>
        </div>
      )}
    </Header>
  )
}
