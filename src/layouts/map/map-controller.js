import { Controller } from "stimulus"
import { setAppState } from "../../js/app"
import { trigger } from "../../js/utils"

export default class extends Controller {
  connect() {
    setAppState("is-map")
    Promise.resolve().then(() => trigger("mapview:show"))
  }
}
