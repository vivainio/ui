/*
 * Copyright (c) 2025-2026 Zensical and contributors
 *
 * SPDX-License-Identifier: MIT
 * Third-party contributions licensed under DCO
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { h } from "~/utilities"

import css from "./zoom.css"

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Open a Mermaid diagram in a full-screen modal with pan and zoom
 *
 * The diagram is copied into a shadow root of its own, so that its styles stay
 * isolated from the page, exactly as they are on the page itself.
 *
 * @param source - Shadow root of the rendered diagram
 */
export function zoomMermaid(source: ShadowRoot): void {
  const box = source.querySelector("svg")?.viewBox.baseVal
  if (!box?.width)
    return

  // Create modal dialog, which provides focus handling and closing on Escape
  const dialog = h("dialog", { class: "mermaid-zoom" })
  dialog.style.cssText = "width: 100vw; max-width: none; height: 100vh; " +
    "max-height: none; padding: 0; border: 0; " +
    "color: var(--md-default-fg-color); background: var(--md-default-bg-color)"
  const host = h("div")
  const root = host.attachShadow({ mode: "open" })
  dialog.append(host)
  root.innerHTML = `
    <style>${css}</style>
    <div class="tools">
      <button data-zoom="out" title="Zoom out (-)">&minus;</button>
      <button data-zoom="fit" title="Fit to window (0)">Fit</button>
      <button data-zoom="in" title="Zoom in (+)">+</button>
      <button data-zoom="close" title="Close (Esc)">&times;</button>
    </div>
    <div class="view">${source.innerHTML}</div>
  `

  // Let the diagram be sized by us, not by its container
  const view = root.querySelector<HTMLElement>(".view")!
  const svg = view.querySelector("svg")!
  svg.removeAttribute("width")
  svg.removeAttribute("height")
  svg.style.maxWidth = "none"

  // Zoom around a point of the view, so what is under it stays in place
  let scale = 1
  const zoom = (
    next: number,
    x = view.clientWidth / 2, y = view.clientHeight / 2
  ) => {
    next = Math.min(8, Math.max(0.1, next))
    const k = next / scale
    scale = next
    svg.style.width = `${box.width * scale}px`
    view.scrollLeft = (view.scrollLeft + x) * k - x
    view.scrollTop = (view.scrollTop + y) * k - y
  }
  const fit = () => {
    scale = 1
    zoom(Math.min(
      view.clientWidth / box.width,
      view.clientHeight / box.height
    ))
    view.scrollTo(0, 0)
  }

  // Buttons and keyboard
  root.addEventListener("click", ev => {
    const action = (ev.target as HTMLElement).closest?.("[data-zoom]")
      ?.getAttribute("data-zoom")
    if (action === "in") zoom(scale * 1.25)
    if (action === "out") zoom(scale / 1.25)
    if (action === "fit") fit()
    if (action === "close") dialog.close()
  })
  dialog.addEventListener("keydown", ev => {
    if (ev.key === "+" || ev.key === "=") zoom(scale * 1.25)
    if (ev.key === "-") zoom(scale / 1.25)
    if (ev.key === "0") fit()
  })

  // Ctrl + wheel, which is also how trackpads report pinch, zooms
  view.addEventListener("wheel", ev => {
    if (!ev.ctrlKey)
      return
    ev.preventDefault()
    const { left, top } = view.getBoundingClientRect()
    zoom(scale * Math.exp(-ev.deltaY * 0.01), ev.clientX - left, ev.clientY - top)
  }, { passive: false })

  // Drag to pan
  let drag: { x: number, y: number, left: number, top: number } | undefined
  view.addEventListener("pointerdown", ev => {
    drag = { x: ev.clientX, y: ev.clientY, left: view.scrollLeft, top: view.scrollTop }
    view.setPointerCapture(ev.pointerId)
  })
  view.addEventListener("pointermove", ev => {
    if (!drag)
      return
    view.scrollLeft = drag.left - (ev.clientX - drag.x)
    view.scrollTop = drag.top - (ev.clientY - drag.y)
  })
  view.addEventListener("pointerup", () => { drag = undefined })

  // Show modal, and remove it again when closed
  dialog.addEventListener("close", () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  fit()
}
