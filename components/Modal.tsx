import { ModalOverlay, Modal as BaseModal, Dialog } from "react-aria-components";
import React from "react";
import { MONO } from "@/fonts";
import sty from "./Modal.module.css";
import classNames from "classnames";

export function Modal(props: {
  children?: React.ReactNode | ((ps: {close: () => void}) => React.ReactNode);
  underlayBlur?: boolean;
  modalBlur?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { children, underlayBlur, modalBlur, isOpen, onOpenChange, ...rest } = props;
  return (
    <ModalOverlay
      className={classNames("app", "dark", MONO.variable, sty.underlay, {[sty.blurred]: underlayBlur})}
      isOpen={isOpen}
      isDismissable={true}
      onOpenChange={onOpenChange}
    >
      <BaseModal
        className={classNames(sty.modal, {[sty.blurred]: modalBlur})}
      >
        <div
          onKeyDown={e => e.stopPropagation()}
          onKeyUp={e => e.stopPropagation()}
          onKeyPress={e => e.stopPropagation()}
        >
          <Dialog className={sty.dialog}>
            {children}
          </Dialog>
        </div>
      </BaseModal>
    </ModalOverlay>
  )
}

/**
 * Works like Modal but doesn't lock focus; allows interaction
 * behind the alert
 */
export function Alert(props: {
  children?: React.ReactNode;
  underlayBlur?: boolean;
  modalBlur?: boolean;
  isOpen?: boolean;
}) {
  const { children, underlayBlur, modalBlur, isOpen, ...rest } = props;
  return (
    <ModalOverlay
      className={classNames("app", "dark", MONO.variable, sty.underlay, sty.modalAlert, {[sty.blurred]: underlayBlur})}
      isOpen={isOpen}
      isDismissable={false}
    >
      <BaseModal
        className={classNames(sty.modal, {[sty.blurred]: modalBlur})}
      >
        {children}
      </BaseModal>
    </ModalOverlay>
  )
}