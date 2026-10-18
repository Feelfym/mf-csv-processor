import { useEffect, useRef } from 'react';
import type React from 'react';

/**
 * 開いているモーダルのスタック。
 * ESC やフォーカストラップは「一番上のモーダル」だけが処理する。
 */
const modalStack: symbol[] = [];

/** いずれかのモーダルが開いているか（テーブル等のショートカット抑止用） */
export const isAnyModalOpen = () => modalStack.length > 0;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const TEXT_INPUT_SELECTOR =
  'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]), textarea:not([disabled])';

const getFocusable = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );

interface UseModalOptions {
  /** 背景クリックで閉じるか（入力途中のデータを失いやすいモーダルでは false 推奨） */
  closeOnBackdrop?: boolean;
}

/**
 * モーダル共通の挙動をまとめたフック
 * - ESC で閉じる（入れ子の場合は最前面のみ）
 * - 開いた時に最初の入力欄（なければダイアログ本体）へフォーカス
 * - Tab / Shift+Tab のフォーカスをモーダル内に閉じ込める
 * - 閉じた時に元の要素へフォーカスを戻す
 * - 背景のスクロールをロック
 * - 背景クリックで閉じる（オプション）
 */
export function useModal(
  isOpen: boolean,
  onClose: () => void,
  { closeOnBackdrop = true }: UseModalOptions = {}
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol('modal');
    modalStack.push(id);
    const isTop = () => modalStack[modalStack.length - 1] === id;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 初期フォーカス（描画完了後）
    const raf = requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const target =
        root.querySelector<HTMLElement>('[data-autofocus]') ??
        root.querySelector<HTMLElement>(TEXT_INPUT_SELECTOR) ??
        root;
      target.focus({ preventScroll: true });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = getFocusable(root);
        if (focusables.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const outside = !active || !root.contains(active);

        if (e.shiftKey && (active === first || active === root || outside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || outside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // capture フェーズで登録し、window 側のテーブル用ショートカットより先に処理する
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      const idx = modalStack.indexOf(id);
      if (idx !== -1) modalStack.splice(idx, 1);
      if (modalStack.length === 0) {
        document.body.style.overflow = prevOverflow;
      }
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  /** 背景（オーバーレイ）要素に展開する props */
  const overlayProps = {
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
      mouseDownOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      // テキスト選択中にモーダル外でマウスを離した場合などは閉じない
      if (closeOnBackdrop && mouseDownOnBackdrop.current && e.target === e.currentTarget) {
        onCloseRef.current();
      }
      mouseDownOnBackdrop.current = false;
    },
  };

  /** ダイアログ本体に展開する props */
  const dialogProps = {
    ref: dialogRef,
    role: 'dialog' as const,
    'aria-modal': true as const,
    tabIndex: -1,
  };

  return { overlayProps, dialogProps };
}
