/*
 * metadata.js v1.0
 * https://github.com/rfrench/metadata.js
 *
 * Copyright 2014, Ryan French
 *
 * Licence: Do What The Fuck You Want To Public License
 * http://www.wtfpl.net/
 */

/*global console, jDataView, window, Blob, ArrayBuffer, Uint8Array */
var metadata = (function() { 'use strict';
  var IFD0 = {
        0x8825: "GPSInfoIFDPointer",
        0x0112: "Orientation",
        0x010F: "Make",
        0x0110: "Model",
        0x013B: "Artist",
        0x8298: "Copyright"
  };

  var GPSInfo = {
        0x0001: "GPSLatitudeRef",
        0x0002: "GPSLatitude",
        0x0003: "GPSLongitudeRef",
        0x0004: "GPSLongitude"
  };
  function gpsToDegree(rational, sign) {
    try {
      if (!rational || !sign)
        return null;
      
      var rationals = rational.split(' ');
      if (rationals.length != 3)
        return null;
            
      var degrees = rationalToFloat(rationals[0]);
      var minutes = rationalToFloat(rationals[1]);
      var seconds = rationalToFloat(rationals[2]);

      var degree = roundFloat(degrees + (minutes / 60.0) + (seconds / 3600.0)) * sign;
      if (isNaN(degree))
        return null;
      
      return degree;
    }
    catch (e) {
      return null;
    }
  }
  function rationalToFloat(rational) {
    var parsedRational = rational.split('/');
    if (parsedRational.length == 2) {
      var nominator = parseFloat(parsedRational[0]);
      var denominator = parseFloat(parsedRational[1]);

      return (nominator / denominator);
    }
  }
  function roundFloat(number) {
    var multiple = Math.pow(10, 6);
    var roundedNumber = Math.round(number * multiple) / multiple;

    return roundedNumber;
  }
  function refToSign(ref) {
    if (!ref) { return null; }

    switch (ref.toUpperCase())
    {
      case "N":
      case "E":
        return 1.0;
      case "S":
      case "W":
        return -1.0;
    }
  }
  function getExifMarker(sourceArrayBuffer, marker) {
    if (marker.type === 0xFFE1) {
      var view = new jDataView(slice(sourceArrayBuffer, marker.position + 4, ((marker.position + 4) + marker.size)));
      if (view.getString(4) === 'Exif') { return view; }
    }

    return;
  }
  function readExifTags(ifds, start, position, view, littleEndian) {
    var entries = view.getUint16(position, littleEndian);
    var tags = [];

    for (var i = 0; i < entries; i++) {
      var tag = view.getUint16(position + 2, littleEndian);
      var tagName = ifds[tag];
      if (tagName) {
        var type = view.getUint16(position + 4, littleEndian);
        var length = view.getUint32(position + 6, littleEndian);
        var offset = view.getUint32(position + 10, littleEndian);
        tags[tagName] = getTagValue(view, type, length, position, (offset + start), littleEndian);
      }
      position += 12;
    }

    return tags;
  }
  function getTagValue(view, type, length, position, offset, littleEndian) {
    var pos = (length > 4) ? offset : position + 10;
    switch (type) {
      case 2: //string
        return view.getString((length - 1), pos);
      case 3: //short
        return view.getUint16(pos, littleEndian);
      case 4: //long
        return view.getUint32(pos, littleEndian);
      case 5: // rational (should always be 3 for what we want)
        var numerator, denominator;
        if (length === 3) {
          var arr = [];
          for (var i = 0; i < length; i++) {
            numerator = view.getUint32(offset + i*8, littleEndian);
            denominator = view.getUint32(offset + 4 + i*8, littleEndian);
            arr.push(numerator + '/' + denominator);
          }
          return arr.join(' ');
        }
        break;
    }
  }
  function slice(sourceArray, start, end) {
    if (sourceArray.slice) {
      try { return sourceArray.slice(start, end); } catch(e) { }
    }

    //IE 10 support
    var size = (end - start);
    var source = new Uint8Array(sourceArray);
    var buffer = new ArrayBuffer(size);
    var result = new Uint8Array(buffer);
    for (var i = 0; i < size; i++) {
      result[i] = source[i + start];
    }
    return result;
  }
  function isAPPMarker(type) {
    return ((type >= 0xFFE1 && type <= 0xFFEF) || type === 0xFFFE);
  }
  function createBlob(markers) {
    if (window.Blob) {
      try { return new Blob(markers, {type: 'image/jpeg'}); } catch(e) {}
    }

    //pre blob support
    var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;

    var bb = new BlobBuilder();
    for (var i = 0; i < markers.length; i++) {
      bb.append(markers[i]);
    }

    return bb.getBlob('image/jpeg');
  }
  function parse(sourceArrayBuffer) {
    var jpegMarkers = {valid: false, sosPosition: 0, appMarkers: [], markers: []};
    var type, size, position = 0;
    var view = new jDataView(sourceArrayBuffer);

    //valid jpeg?
    if (view.getUint16() !== 0xFFD8) { return jpegMarkers; }

    //if for some reason we don't find the SOS marker
    //this should stop us from getting out of control.
    var maxLength = Math.min(sourceArrayBuffer.byteLength, 2097152);
    while (view.tell() < maxLength) {
      type = view.getUint16();

      switch(type)
      {
        case 0xFFE0: //APP0
        case 0xFFE1: //APP1
        case 0xFFE2: //APP2
        case 0xFFE3: //APP3
        case 0xFFE4: //APP4
        case 0xFFE5: //APP5
        case 0xFFE6: //APP6
        case 0xFFE7: //APP7
        case 0xFFE8: //APP8
        case 0xFFE9: //APP9
        case 0xFFEA: //APP10
        case 0xFFEB: //APP11
        case 0xFFEC: //APP12
        case 0xFFED: //APP13
        case 0xFFEE: //APP14
        case 0xFFEF: //APP15
        case 0xFFC0: //SOF0
        case 0xFFC1: //SOF1
        case 0xFFC2: //SOF2
        case 0xFFC3: //SOF3
        case 0xFFDB: //DQT
        case 0xFFDC: //DNL
        case 0xFFDD: //DRI
        case 0xFFDE: //DHP
        case 0xFFDF: //EXP
        case 0xFFC4: //DHT
        case 0xFFC5: //SOF5
        case 0xFFC6: //SOF6
        case 0xFFC7: //SOF7
        case 0xFFC8: //JPG
        case 0xFFC9: //SOF9
        case 0xFFCA: //SOF10
        case 0xFFCB: //SOF11
        case 0xFFCC: //DAC
        case 0xFFCD: //SOF13
        case 0xFFCE: //SOF14
        case 0xFFCF: //SOF15
        case 0xFFFE: //COM
        /* I'm not positive the following markers can be within the header */
        case 0xFFD0: //RST0
        case 0xFFD1: //RST1
        case 0xFFD2: //RST2
        case 0xFFD3: //RST3
        case 0xFFD4: //RST4
        case 0xFFD5: //RST5
        case 0xFFD6: //RST6
        case 0xFFD7: //RST7
        case 0xFFF0: //JPG0
        case 0xFFF1: //JPG1
        case 0xFFF2: //JPG2
        case 0xFFF3: //JPG3
        case 0xFFF4: //JPG4
        case 0xFFF5: //JPG5
        case 0xFFF6: //JPG6
        case 0xFFF7: //JPG7
        case 0xFFF8: //JPG8
        case 0xFFF9: //JPG9
        case 0xFFFA: //JPG10
        case 0xFFFB: //JPG11
        case 0xFFFC: //JPG12
        case 0xFFFD: //JPG13
        case 0xFF01: //TEM
          size = view.getUint16();
          position = (view.tell() - 4);
          var marker = { type: type, position: position, size: size };
          if (isAPPMarker(type)) {
            jpegMarkers.appMarkers.push(marker);
          }
          else {
            jpegMarkers.markers.push(marker);
          }
          view.seek((view.tell() + size) - 2);
          break;
      }

      //SOS marker means we're done
      if (type === 0xFFDA) {
        jpegMarkers.valid = true;
        jpegMarkers.sosPosition = (view.tell() - 2);
        break;
      }
    }

    return jpegMarkers;
  }
  function copy(sourceArrayBuffer, destArrayBuffer, sourceMarkers) {
    var buffers = [], marker;

    //do we already have it parsed?
    if (!sourceMarkers) { sourceMarkers = parse(sourceArrayBuffer); }
    
    //if there is nothing worth copying or something failed, bail out
    var destMarkers = parse(destArrayBuffer);
    if (!sourceMarkers.valid || sourceMarkers.appMarkers.length === 0 || !destMarkers.valid) {
      return createBlob([destArrayBuffer]);
    }

    //no guarentee APP0 marker will be there, but if it is, lets write it first
    var jfifMarker;
    for (var i = 0; i < destMarkers.markers.length; i++) {
      if (destMarkers.markers[i].type === 0xFFE0) {
        jfifMarker = destMarkers.markers[i];
        destMarkers.markers.splice(i, 1);
        break;
      }
    }

    //write SOI
    buffers.push(slice(destArrayBuffer, 0, 2));

    //write the JFIF marker
    if (jfifMarker) {
      buffers.push(slice(destArrayBuffer, jfifMarker.position, (jfifMarker.position + (jfifMarker.size + 2))));
    }

    //copy all the app markers from the source
    for (var i = 0; i < sourceMarkers.appMarkers.length; i++) {
      marker = sourceMarkers.appMarkers[i];
      buffers.push(slice(sourceArrayBuffer, marker.position, (marker.position + (marker.size + 2))));
    }

    //copy all the other markers from the dest
    for (var i = 0; i < destMarkers.markers.length; i++) {
      marker = destMarkers.markers[i];
      buffers.push(slice(destArrayBuffer, marker.position, (marker.position + (marker.size + 2))));
    }

    //copy everything else at the SOS marker
    buffers.push(slice(destArrayBuffer, destMarkers.sosPosition, destArrayBuffer.byteLength));

    return createBlob(buffers);
  }
  function getExif(sourceArrayBuffer, sourceMarkers) {
    var exif = { hasExif: false, copyright: null, artist: null, make: null, model: null, orientation: 0, hasGPSLocation: false, longitude: 0, latitude: 0 };
    
    if (!sourceMarkers) { sourceMarkers = parse(sourceArrayBuffer); }

    //do we have anything worth parsing?
    if (!sourceMarkers.valid || sourceMarkers.appMarkers.length === 0) {
      return exif;
    }

    var view;
    for (var i = 0; i < sourceMarkers.appMarkers.length; i++) {
      view = getExifMarker(sourceArrayBuffer, sourceMarkers.appMarkers[i]);
      if (view) { break; }
    }

    //did we find anything?
    if (!view) { return exif; }

    //set the start position
    var start = view.tell() + 2; //should always be 6

    //skip the 2 null bytes + set endian
    var littleEndian = (view.getUint16(view.tell() + 2) === 0x4949);

    //valid tiff header?
    if (view.getUint16(view.tell(), littleEndian) != 0x002A || view.getUint32(view.tell(), littleEndian) != 0x00000008) {
      return exif;
    }

    //read IFD0 tags first
    var ifdTags = readExifTags(IFD0, start, view.tell(), view, littleEndian);

    //set IFD0 values
    if (ifdTags) {
      exif.hasExif = true;
      exif.copyright = (ifdTags.Copyright) ? ifdTags.Copyright : null;
      exif.make = (ifdTags.Make) ? ifdTags.Make : null;
      exif.model = (ifdTags.Model) ? ifdTags.Model : null;
      exif.artist = (ifdTags.Artist) ? ifdTags.Artist : null;
      exif.orientation = (ifdTags.Orientation) ? ifdTags.Orientation : 0;
      
      //do we have a GPS info pointer?
      if (ifdTags.GPSInfoIFDPointer) {
        var gpsTags = readExifTags(GPSInfo, start, ifdTags.GPSInfoIFDPointer + 6, view, littleEndian);
        var latRef = refToSign(gpsTags.GPSLatitudeRef);
        var longRef = refToSign(gpsTags.GPSLongitudeRef);
        if ((latRef !== null) && (longRef !== null)) {
          var latitude = gpsToDegree(gpsTags.GPSLatitude, latRef);
          var longitude = gpsToDegree(gpsTags.GPSLongitude, longRef);
          if ((latitude !== null) && (longitude !== null)) {
            exif.hasGPSLocation = true;
            exif.latitude = latitude;
            exif.longitude = longitude;
          }
        }
      }
    }
    return exif;
  }
  return {
    parse: function(sourceArrayBuffer) {
      return parse(sourceArrayBuffer);
    },
    copy: function(sourceArrayBuffer, destArrayBuffer, sourceMetadata) {
      return copy(sourceArrayBuffer, destArrayBuffer, sourceMetadata);
    },
    getExif: function(sourceArrayBuffer, sourceMetadata) {
      return getExif(sourceArrayBuffer, sourceMetadata);
    }
  };
})();