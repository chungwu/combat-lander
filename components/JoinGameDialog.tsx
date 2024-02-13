import { Form, Heading } from "react-aria-components";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Modal } from "./Modal";

export function JoinGameDialog(props: {
  defaultName: string;
  onJoin: (opts: {name: string}) => void;
}) {
  const { onJoin, defaultName } = props;
  return (
    <Modal underlayBlur>
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
          <Heading slot="title">Join this game</Heading>
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
    </Modal>
  );
}