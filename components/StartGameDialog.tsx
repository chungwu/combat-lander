import { Form, Heading } from "react-aria-components";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Modal } from "./Modal";
import { Checkbox } from "./Checkbox";
import { GameOptions } from "@/game/game-state";

export function StartGameDialog(props: {
  defaultName: string;
  onStart: (opts: {
    name: string;
    options: GameOptions
  }) => void;
}) {
  const { onStart, defaultName } = props;
  return (
    <Modal underlayBlur>
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            console.log("FORM DATA", data);
            onStart({
              name: data.get("name")?.toString() ?? defaultName,
              options: extractGameOptions(data)
            });
            close();
          }}
        >
          <Heading slot="title">Start new game</Heading>

          <TextField 
            label="Your name"
            name="name" 
            defaultValue={defaultName}
            autoFocus
            autoSelectAll
          />

          <GameOptionsForm />
          <div style={{display: "flex", gap: 24}}>
            <Button type="submit" styleType="primary">Start!</Button>
            <Button styleType="clear" onPress={close}>Nevermind...</Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

export function ResetGameDialog(props: {
  onStart: (opts: GameOptions) => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { onStart, isOpen, onClose } = props;
  return (
    <Modal underlayBlur {...isOpen == null ? {} : {isOpen}}>
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onStart(extractGameOptions(data));
            close();
            onClose?.();
          }}
        >
          <Heading slot="title">Reset game</Heading>

          <GameOptionsForm />
          <div style={{display: "flex", gap: 24}}>
            <Button type="submit" styleType="primary" autoFocus>Start!</Button>
            <Button styleType="clear" onPress={() => {
              close();
              onClose?.();
            }}>Nevermind...</Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

function extractGameOptions(data: FormData): GameOptions {
  const infiniteHealth = !!data.get("infiniteHealth");
  const infiniteFuel = !!data.get("infiniteFuel");

  localStorage.setItem("infiniteHealth", `${infiniteHealth}`);
  localStorage.setItem("infiniteFuel", `${infiniteFuel}`);
  return { infiniteHealth, infiniteFuel };
}

function getLocalBoolean(name: string, defaultValue: boolean) {
  const value = localStorage.getItem(name);
  if (value == null) {
    return defaultValue;
  } else {
    return value === "true";
  }
}

function GameOptionsForm() {
  const defaultInfiniteHealth = getLocalBoolean("infiniteHealth", true);
  const defaultInfiniteFuel = getLocalBoolean("infiniteFuel", true);
  return (
    <div style={{display: "flex", gap: 24}}>
      <Checkbox 
        name="infiniteHealth" 
        defaultSelected={defaultInfiniteHealth}
      >
        Infinite health?
      </Checkbox>
      <Checkbox 
        name="infiniteFuel" 
        defaultSelected={defaultInfiniteFuel}
      >
        Infinite fuel?
      </Checkbox>
    </div>
  );
}