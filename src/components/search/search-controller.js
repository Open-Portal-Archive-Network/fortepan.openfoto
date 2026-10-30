import { Controller } from "stimulus"

import { trigger, getLocale, getURLParams, searchValuesToQueryParams, urlParamsToSearchValues } from "../../js/utils"
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
    const searchParams = searchValuesToQueryParams(this.inputTarget.selectizeControl.value)
    const q = searchParams.length > 0 ? `?${searchParams.join("&")}` : "?q"

    if (appState("is-map")) {
      // keep the map position, replace the search
      const mapParams = getURLParams()
      const mapQuery = ["gc", "gz"].filter(key => mapParams[key]).map(key => `${key}=${mapParams[key]}`)
      window.history.pushState(null, null, `/${getLocale()}/map/?${mapQuery.concat(searchParams).join("&")}`)
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

  // removing a tag updates the results right away on the photos and map pages
  onTagRemoved() {
    if (appState("is-map") || window.location.pathname.indexOf("/photos") > -1) this.submit()
  }

  // replaces the tags with the search values of the current url (no values clear the field)
  syncWithURL() {
    this.inputTarget.selectizeControl.value = urlParamsToSearchValues(getURLParams()).join(",")
  }

  showAdvancedSearchDialog(e) {
    if (e) e.preventDefault()
    trigger("dialogAdvancedSearch:show")
  }
}
