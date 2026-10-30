import { Controller } from "stimulus"
import { appState } from "../../../js/app"
import { trigger, getURLParams, getLocale, searchValuesToQueryParams, urlParamsToSearchValues } from "../../../js/utils"

export default class extends Controller {
  static get targets() {
    return ["form", "input"]
  }

  connect() {
    this.formTarget.submit = this.submit.bind(this)
  }

  submit(e) {
    if (e) e.preventDefault()

    const searchParams = searchValuesToQueryParams(this.inputTarget.selectizeControl.value)
    const q = searchParams.length > 0 ? `?${searchParams.join("&")}` : "?q"

    if (appState("is-map")) {
      // keep the map position, replace the search
      const mapParams = getURLParams()
      const mapQuery = ["gc", "gz"].filter(key => mapParams[key]).map(key => `${key}=${mapParams[key]}`)
      window.history.pushState(null, null, `/${getLocale()}/map/?${mapQuery.concat(searchParams).join("&")}`)
      this.hide()
      trigger("mapview:load")
    } else if (window.location.pathname.indexOf("/photos") === -1 || appState("is-lists")) {
      window.location = `/${getLocale()}/photos/${q}`
    } else {
      trigger("photos:historyPushState", {
        url: q,
        resetPhotosGrid: true,
      })

      trigger("dialogSearch:hide")
    }
  }

  // removing a tag updates the results right away, but keeps the dialog open for more edits
  onTagRemoved() {
    if (!appState("is-map") && (window.location.pathname.indexOf("/photos") === -1 || appState("is-lists"))) return

    this.keepOpen = true
    this.submit()
    this.keepOpen = false
  }

  show() {
    this.element.classList.add("is-visible")
    this.inputTarget.selectizeControl.reset()
    this.inputTarget.selectizeControl.focus()

    this.inputTarget.selectizeControl.value = urlParamsToSearchValues(getURLParams()).join(",")
  }

  hide() {
    if (this.keepOpen) return
    this.element.classList.remove("is-visible")
  }

  showAdvancedSearchDialog(e) {
    e.preventDefault()
    this.hide()
    trigger("dialogAdvancedSearch:show")
  }
}
