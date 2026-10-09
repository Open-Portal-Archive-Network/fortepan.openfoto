import { Controller } from "stimulus"

import { trigger, getLocale, getURLParams } from "../../js/utils"
import { appState } from "../../js/app"

export default class extends Controller {
  static get targets() {
    return ["form", "input", "icon"]
  }

  connect() {
    // overwrite default form submit
    this.formTarget.submit = this.submit.bind(this)
  }

  submit(e) {
    if (e) e.preventDefault()

    this.inputTarget.selectizeControl.addTagNode(this.inputTarget.selectizeControl.inputTarget.value)
    const q = `?q=${this.inputTarget.selectizeControl.value.join(", ")}`

    if (appState("is-map")) {
      const params = getURLParams()
      delete params.gb
      params.q = this.inputTarget.selectizeControl.value.join(", ")
      window.history.pushState(null, null, `/${getLocale()}/map/?${new URLSearchParams(params).toString()}`)
      this.inputTarget.selectizeControl.blur()
      trigger("mapview:load")
    } else if (window.location.pathname.indexOf("/photos") === -1) {
      window.location = `/${getLocale()}/photos/${q}`
    } else {
      trigger("photos:historyPushState", {
        url: q,
        resetPhotosGrid: true,
      })

      this.inputTarget.selectizeControl.blur()
      trigger("dialogSearch:hide")
    }
  }

  clear() {
    this.inputTarget.selectizeControl.value = ""
  }

  setValue(e) {
    this.inputTarget.selectizeControl.value = e.detail.value
  }
}
