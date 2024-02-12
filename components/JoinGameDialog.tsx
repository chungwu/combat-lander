import { Dialog, Form, Heading, Input, Label, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "./Button";
import { TextField } from "./TextField";
import React from "react";

export function JoinGameDialog(props: {
  defaultName: string;
  onJoin: (opts: {name: string}) => void;
}) {
  const { onJoin, defaultName } = props;
  const nameRef = React.useRef<HTMLInputElement>(null);
  return (
    <ModalOverlay 
      style={{
        position: "fixed", 
        top: 0, left: 0, right: 0, bottom: 0, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        backdropFilter: "blur(8px)",
      }}
    >
      <Modal 
        className={"app dark"} 
        style={{
          padding: 32,
          border: "1px solid white"
        }}
      >
        <Dialog>
          {({close}) => (
            <Form
              style={{display: "flex", flexDirection: "column", gap: 24}}
              onSubmit={e => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                onJoin({name: data.name.toString()});
                close();
              }}
            >
              <Heading>Join this game</Heading>
              <TextField 
                label="Your name"
                name="name" 
                defaultValue={defaultName}
                autoFocus
                autoSelectAll
              />
              <div style={{display: "flex", gap: 24}}>
                <Button type="submit" styleType="primary">Join!</Button>
                <Button styleType="clear" onPress={close}>Cancel</Button>
              </div>
            </Form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}