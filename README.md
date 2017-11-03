# metadata.js
metadata.js is a JavaScript library for parsing & copying JPEG metadata from ArrayBuffers.

## Why?
While I'm a huge fan of being able to resize images in the browser via the canvas, I hate the fact that it strips information such as EXIF, IPTC, XMP, Camera Makernotes, ICC profiles and JPEG comments. I couldn't find anything to solve this problem, so I made this my weekend project. It works in all modern browsers, but it will require checks to see if the browser supports ArrayBuffer, Uint8Array, and Blobs. This API is production ready and has been tested with thousands of JPEGs.

## Requirements
metadata.js requires [jDataView](https://github.com/vjeux/jDataView) for reading binary files. Please pull the latest from their repository.

## API
* **parse**(sourceArrayBuffer)
* **copy**(sourceArrayBuffer, destArrayBuffer)
* **copy**(sourceArrayBuffer, destArrayBuffer, sourceMetadata)
* **getExif**(sourceArrayBuffer)
* **getExif**(sourceArrayBuffer, sourceMetadata)

## EXIF
Basic EXIF support has been added. If you want full exif support, check out Jacob Seidelin's [EXIF](http://blog.nihilogic.dk/2008/05/reading-exif-data-with-javascript.html) parser. The following properties are available:

* **Model**
* **Maker**
* **Artist**
* **Copyright**
* **Orientation**
* **Latitude**
* **Longitude**

## Example

### Copy JPEG metadata
``` js
//copy the metadata from the source image to the destination image
var blob = metadata.copy(sourceArrayBuffer, destArrayBuffer);
```

### Parse & Copy JPEG metadata
``` js
//parse the metadata first
var sourceMetadata = metadata.copy(sourceArrayBuffer);

//copy the metadata from the source image to the destination image
var blob = metadata.copy(sourceArrayBuffer, destArrayBuffer, sourceMetadata);
```

### Parse EXIF
``` js
//parse the EXIF data
var exif = metadata.getExif(sourceArrayBuffer);

//display the lat/long on google maps
if (exif.hasGPSLocation) {
  var mapOptions = {
    center: new google.maps.LatLng(exif.latitude, exif.longitude),
    zoom: 15,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map($('#map')[0], mapOptions);
}
```

## Resources
* [JPEG marker reader](http://fhtr.org/DataStream.js/jpeg.html) - Really helpful when you need to visualize all the markers in a JPEG.
* [JPEGSnoop](http://www.impulseadventure.com/photo/jpeg-snoop.html) - Visualize all the markers in a JPEG. (Windows)
* [JPEGDump](http://www.a-kat.com/programming/cpp/jpeg/JPEGDump.html) - Command line tool for visualizing markers. (Windows)
* [Hexfiend](http://ridiculousfish.com/hexfiend/) - Awesome open source HEX editor (OSX)
* [code.flickr](http://code.flickr.net/2012/06/01/parsing-exif-client-side-using-javascript-2/) - Good ariticle about how they handle EXIF data. Also some useful information about JPEG markers.
* [Mozilla Developer Network](https://developer.mozilla.org/) - nuff said.
