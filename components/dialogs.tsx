import { GameOptions } from "@/game/game-state";
import { useRouter } from "next/router";
import { Form, Heading } from "react-aria-components";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Modal } from "./Modal";
import { TextField } from "./TextField";
import { isTouchDevice } from "@/utils/utils";
import { SelectField, SelectOption } from "./Select";
import { getControlScheme, setControlScheme } from "@/game/controls";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { LANDER_COLORS, LANDER_COLORS_MAP, LanderColor, getLanderColor } from "@/game/constants";

export function StartGameDialog(props: {
  curSettings: PlayerSettings;
  onStart: (opts: {
    settings: PlayerSettings;
    options: GameOptions;
  }) => void;
}) {
  const { onStart, curSettings } = props;
  return (
    <Modal underlayBlur>
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onStart({
              settings: {
                name: data.get("name")?.toString() as string,
                color: data.get("color")?.toString() as LanderColor,
              },
              options: extractGameOptions(data)
            });
            close();
          }}
        >
          <Heading slot="title">Start new game</Heading>

          <LanderSettingsFormPart curSettings={curSettings} />

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
    <Modal 
      underlayBlur 
      onOpenChange={open => {
        if (!open) {
          onClose?.();
        }
      }}
      {...isOpen == null ? {} : {isOpen}}
    >
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

export function InviteGameDialog() {
  const url = window.location.href;
  const [copied, setCopied] = React.useState(false);
  return (
    <Modal underlayBlur>
      {({close}) => (
        <div style={{display: "flex", flexDirection: "column", gap: 24}}>
          <Heading slot="title">Invite your friends</Heading>

          <p>
            You can invite people to this game by just sharing the url!
          </p>

          <div style={{display: "flex", gap: 8}}>
            <TextField style={{flexGrow: 1}} value={url} autoFocus autoSelectAll isReadOnly />
            <Button onPress={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }} aria-label="Copy invite url">
              <FontAwesomeIcon icon={faCopy} />
            </Button>
          </div>

          {copied && <div>Copied!</div>}

          <Button style={{alignSelf: "flex-start"}} type="submit" styleType="primary" onPress={() => {
            close();
          }}>Close</Button>
        </div>
      )}
    </Modal>
  );
}


export interface PlayerSettings {
  name: string;
  color: LanderColor;
}
export function PlayerInfoDialog(props: {
  curSettings: PlayerSettings;
  onSave: (opts: PlayerSettings) => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { curSettings, onSave, isOpen, onClose } = props;
  return (
    <Modal underlayBlur {...isOpen == null ? {} : {isOpen}}>
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onSave({
              name: data.get("name")!.toString(),
              color: data.get("color")!.toString() as LanderColor,
            });
            if (data.get("controlScheme")) {
              setControlScheme(data.get("controlScheme")!.toString() as any);
            }
            close();
            onClose?.();
          }}
        >
          <Heading slot="title">Player settings</Heading>

          <LanderSettingsFormPart curSettings={curSettings} />
          {isTouchDevice() && (
            <SelectField 
              label="Control scheme" 
              name="controlScheme" 
              defaultSelectedKey={getControlScheme()}
            >
              <SelectOption id="sticky">Single joystick</SelectOption>
              <SelectOption id="duo">Dual joystick</SelectOption>
              <SelectOption id="keyboard">Arrow keys</SelectOption>
            </SelectField>
          )}
          <div style={{display: "flex", gap: 24}}>
            <Button type="submit" styleType="primary" autoFocus>Save</Button>
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

function LanderSettingsFormPart(props: {
  curSettings: PlayerSettings;
}) {
  const { curSettings } = props;
  return (
    <div style={{display: "flex", gap: 8, alignItems: "flex-end"}}>
      <TextField 
        label="Your name"
        name="name" 
        defaultValue={curSettings.name}
        autoFocus
        autoSelectAll
        style={{flexGrow: 1}}
      />
      <SelectField 
        aria-label="Lander color" 
        name="color" 
        defaultSelectedKey={curSettings.color}
        renderSelected={(opts) => {
          console.log("RENDER", opts);
          if (!opts.selectedText) {
            return null;
          }
          return (
            <div style={{width: 18, height: 18, backgroundColor: getLanderColor(opts.selectedText as LanderColor, 10)}} />
          );
        }}
      >
        {LANDER_COLORS.map((color: LanderColor) => (
          <SelectOption id={color} aria-label={color} textValue={color}>
            <div style={{display: "flex", alignItems: "center", gap: 4}}>
              <div style={{width: 16, height: 16, backgroundColor: getLanderColor(color, 10)}} />
              <div>{color}</div>
            </div>
          </SelectOption>
        ))}
      </SelectField>
    </div>
  );
}


export function JoinGameDialog(props: {
  curSettings: PlayerSettings;
  onJoin: (opts: PlayerSettings) => void;
}) {
  const { onJoin, curSettings } = props;
  return (
    <Modal underlayBlur>
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            onJoin({name: data.name.toString(), color: data.color.toString() as LanderColor});
            close();
          }}
        >
          <Heading slot="title">Join this game</Heading>
          <LanderSettingsFormPart curSettings={curSettings} />
          <div style={{display: "flex", gap: 24}}>
            <Button type="submit" styleType="primary">Join!</Button>
            <Button styleType="clear" onPress={close}>Nah...</Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

export function ChatDialog(props: {
  onSend: (opts: {message: string}) => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { onSend, isOpen, onClose } = props;
  return (
    <Modal 
      underlayBlur 
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
      {...isOpen == null ? {} : {isOpen}} 
    >
      {({close}) => (
        <Form
          style={{display: "flex", flexDirection: "column", gap: 24}}
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const message = data.get("message")?.toString();
            if (message) {
              onSend({message});
            }
            close();
            onClose?.();
          }}
        >
          <TextField 
            label="Message" 
            name="message"
            autoFocus
            autoComplete="off"
          />
          <div style={{display: "flex", gap: 24}}>
            <Button type="submit" styleType="primary">Send</Button>
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