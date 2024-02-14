import { ModalOverlay, Modal as BaseModal, Dialog } from "react-aria-components";
import React from "react";
import { MONO } from "@/fonts";

export function Modal(props: {
  children?: React.ReactNode | ((ps: {close: () => void}) => React.ReactNode);
  underlayBlur?: boolean;
  modalBlur?: boolean;
  isOpen?: boolean;
}) {
  const { children, underlayBlur, modalBlur, isOpen, ...rest } = props;
  return (
    <ModalOverlay 
      className={`app dark ${MONO.variable}`}
      isOpen={isOpen}
      style={{
        position: "fixed", 
        top: 0, left: 0, right: 0, bottom: 0, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        backdropFilter: underlayBlur ? "blur(8px)" : undefined,
      }}
    >
      <BaseModal 
        style={{
          padding: 32,
          border: "1px solid white",
          backdropFilter: modalBlur ? "blur(8px)" : undefined,
          zIndex: 5,
        }}
      >
        <Dialog style={{outline: "none"}}>
          {children}
        </Dialog>
      </BaseModal>
    </ModalOverlay>
  )
}