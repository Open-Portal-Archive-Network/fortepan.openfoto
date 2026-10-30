import { Controller } from "stimulus"

import { trigger, getURLParams, getLocale, getSearchTermKeys } from "../../../js/utils"
import { appState } from "../../../js/app"

const FIELDS_SELECTOR = ".dialog-advanced-search__input input, .dialog-advanced-search__input select"

export default class extends Controller {
  static get targets() {
    return ["form"]
  }

  connect() {
    this.formTarget.submit = this.submit.bind(this)
  }

  submit(e) {
    if (e) e.preventDefault()

    const params = []

    this.formTarget.querySelectorAll(FIELDS_SELECTOR).forEach(input => {
      if (input.value && input.value.trim().length) {
        params.push(`${input.name}=${encodeURIComponent(input.value.trim())}`)
      }
    })

    let queryURL = params.length > 0 ? `?advancedSearch=1&${params.join("&")}` : "?q"

    if (appState("is-map")) {
      // when we are in the map view we need to trigger the mapview:load event to reload the map with the new query parameters
      const existingQueryParams = getURLParams()
      const mapQuery = []

      if (existingQueryParams.gb) mapQuery.push(`gb=${existingQueryParams.gb}`)
      if (existingQueryParams.gc) mapQuery.push(`gc=${existingQueryParams.gc}`)
      if (existingQueryParams.gz) mapQuery.push(`gz=${existingQueryParams.gz}`)

      queryURL = `?${mapQuery.join("&")}&${queryURL.replace("?", "")}`

      window.history.pushState(null, null, `/${getLocale()}/map/${queryURL}`)
      trigger("mapview:load")

      this.hide()
    } else if (window.location.pathname.indexOf("/photos") === -1 || appState("is-lists")) {
      window.location = `/${getLocale()}/photos/${queryURL}`
    } else {
      trigger("photos:historyPushState", {
        url: queryURL,
        resetPhotosGrid: true,
      })

      this.hide()
    }
  }

  show() {
    this.element.classList.add("is-visible")

    // refill the form from the current search terms (advanced search or sidebar links like ?donor=...), or start empty
    const params = getURLParams()
    const keys = getSearchTermKeys(params)

    this.formTarget.querySelectorAll(FIELDS_SELECTOR).forEach(input => {
      input.value = keys.includes(input.name) ? params[input.name] : ""
    })
  }

  hide() {
    this.element.classList.remove("is-visible")
  }
}
