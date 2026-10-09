import { Controller } from "stimulus"

import { numberWithCommas, trigger } from "../../js/utils"

const MARKER_PHOTO_LIMIT = 150

export default class extends Controller {
  static get targets() {
    return ["counter"]
  }

  connect() {
    this.thumbnails = []
    this.element.mapMarker = this

    if (this.element.isESCluster) {
      this.counterTarget.textContent = numberWithCommas(this.element.data.doc_count)
      this.element.classList.add("is-over-limit")
      return
    }

    this.photos = this.element.isGroup ? this.element.data : [this.element.data]
    this.currentIndex = 0

    if (this.element.isGroup) {
      this.counterTarget.textContent = numberWithCommas(this.element.counter)
    } else {
      this.counterTarget.textContent = "1"
      this.element.classList.add("is-single")
    }

    if (this.element.containsESCluster || this.photos.length > MARKER_PHOTO_LIMIT) {
      this.element.classList.add("is-over-limit")
    }
  }

  showPreview() {
    if (this.element.isESCluster || this.element.containsESCluster || this.photos.length > MARKER_PHOTO_LIMIT) {
      return false
    }

    if (this.previewVisible) return true

    const thumbnails = document
      .getElementById("mapmarker-thumbnails-template")
      .content.firstElementChild.cloneNode(true)
    this.element.insertBefore(thumbnails, this.counterTarget)
    this.selectPhoto(0)
    this.previewVisible = true
    return true
  }

  onMarkerClick() {
    this.showPreview()
  }

  createThumbnail(data) {
    const thumbnail = document.getElementById("photos-thumbnail").content.firstElementChild.cloneNode(true)
    thumbnail.setAttribute(
      "data-action",
      thumbnail.getAttribute("data-action").replace("click->thumbnail#clicked", "click->mapmarker#onThumbnailClicked")
    )
    thumbnail.photoId = data.mid
    thumbnail.photo = data.photo
    thumbnail.year = data.year
    thumbnail.forceImageLoad = true
    this.thumbnails.push({ mid: data.mid, element: thumbnail })
    return thumbnail
  }

  selectPhoto(index) {
    const data = this.photos[index]
    if (!data) return

    let thumbnail = this.thumbnails.find(item => item.mid.toString() === data.mid.toString())
    if (thumbnail) {
      thumbnail = thumbnail.element
    } else {
      thumbnail = this.createThumbnail(data)
    }

    const wrapper = this.element.querySelector(".mapmarker__thumbnail-wrapper")
    wrapper.innerHTML = ""
    wrapper.appendChild(thumbnail)
    this.currentIndex = index
  }

  onNextClick(e) {
    e.preventDefault()
    e.stopPropagation()
    this.selectPhoto(this.currentIndex + 1 === this.photos.length ? 0 : this.currentIndex + 1)
  }

  onPrevClick(e) {
    e.preventDefault()
    e.stopPropagation()
    this.selectPhoto(this.currentIndex === 0 ? this.photos.length - 1 : this.currentIndex - 1)
  }

  onThumbnailClicked(e) {
    e.preventDefault()
    e.stopPropagation()
    const photoId = e.currentTarget.photoId
    this.selectPhoto(this.photos.findIndex(photo => photo.mid.toString() === photoId.toString()))
    document.querySelectorAll(".mapmarker").forEach(marker => marker.classList.remove("is-selected"))
    this.element.classList.add("is-selected")
    trigger("mapmarker:photoSelected", { photoId, photoData: this.photos })
  }

  onMouseOver() {
    this.element.parentElement.style.zIndex = 9999
  }

  onMouseOut() {
    this.element.parentElement.style.removeProperty("z-index")
  }
}
