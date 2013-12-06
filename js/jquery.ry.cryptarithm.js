// First pass at a cryptarithm jquery-ui widget 
// Started off small and simple then grew bigger
// as I got sidetracked while exploring the widget factory :)

// I thought about adhering to the jquery-ui css guidelines with 
// ui-widget-content, ui-widget-header, but I have not truly it set up yet.
// I am relying on my own simple CSS for demo purposes.

// this Cryptarithm Widget features:
// - a crude hotkey scheme to navigate the keypad
//  (press on a letter to focus on that letter input)
// - multiple operation types ( currently addition & subtraction )
// TODOs: 
// - auto hide/disable keys that not needed for the current puzzle
 // - better 'solved' message
 //  ( currently only chaning the color of hte result to green )
// - respond to ALL options on setOption
// - test suites

(function ($, undefined) {

  var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  // currently supported operations
  var operations = {
    "addition": {
      className: "addition",
      computeMethod: function (terms) {
        return terms.reduce( 
          function( prev, current ){ return prev + current }
      )}
    },
    "subtraction": {
      className: "subtraction",
      computeMethod: function (terms) {
        return terms.reduce( 
          function( prev, current ){ return prev - current }
      )}
    }
  };

  // digits: number of digits per term
  // keys: subtitution keys for puzzle
  // operation: type of operation - version 0.0.1 supports "additions"
  $.widget('ry.cryptarithm', {
    version: '0.0.1',
    options: {
      digits: 2,
      terms: 2,
      keys: {},
      operation: "addition"
    },

    _create: function () {
      this.element.addClass('ry-cryptarithm ui-widget');

      // puzzle logic
      this.keys = this.options.keys;
      this._generatePuzzle();
      this._processSolution();

      // DOM
      this._createWrapper();
      this._createKeypad();
      this._createPuzzleDisplay();

      // update and display
      this._updateDisplay();
      this._renderMarkup();

      // setup widget handlers
      this._on({
        'keypress .ry-cryptarithm-shell': this._handleHotkeys,
        'keypress .ry-cryptarithm-shell input': this._handleInput,
        'keyup .ry-cryptarithm-shell input': this._handleDelete,
        'click .ry-cryptarithm-reset': this._unassignKeys,
        'cryptarithmassignkey': this._updateKeys,
        'cryptarithmunassignkey': this._updateKeys
      });
    },

    // Handle keyup addition and removal
    // triggers a display update
    _updateKeys: function (e, eventData) {
      if(e.type === "cryptarithmunassignkey") {
        this._unassignKey(eventData.letter);
      } else if (e.type === "cryptarithmassignkey"){
        this._assignKey( eventData.letter, eventData.value);
      }

      this._processSolution();
      this._updateDisplay();
    },

    // Key Helpers
    _getAssignedKey: function (digit) {
      var letter = "";
      $.each(this.keys, function(k, v){
        if( v === digit) { letter = k; }
      }); 
      return letter;
    },

    _assignKey: function ( letter ,digit ) {
      var duplicateKey = this._getAssignedKey(digit);
      if(duplicateKey !== letter) {
        this.keys[letter] = digit;
        if( duplicateKey !== "" ) {
          this._trigger("unassignkey", null, {"letter": duplicateKey});
        }
      }
    },

    getSolution: function () {
      return this.puzzle.solution;
    },

    _unassignKey: function (letter) {
      this.keypad.find("input[name='"+letter+"']").val("");
      delete this.keys[letter];
    },

    _unassignKeys: function () {
      this.keys = {};
      this.keypad.find("input").val("");
      this._processSolution();
      this._updateDisplay();
    },

    // Generate a type of puzzle and encrypt it
    _generatePuzzle: function () {
      this._generateOperation();
      this._generateCipher();
      this._encryptPuzzle();
    },

    // Generate a random puzzle
    _generateOperation: function () {
      var operation = operations[this.options.operation];
      var min = Math.pow(10, this.options.digits-1);
      var max = Math.pow(10, this.options.digits);

      var terms = [];
      for (var i = 0; i < this.options.terms; i++) {
        terms.push( this._randomFromRange(min, max) );
      };  

      this.puzzle = {
        solution: {
          result: operation.computeMethod(terms),
          terms: terms,
        } 
      };
    },

    // encrypt the puzzle with the cipher
    _encryptPuzzle: function () {
      var widget = this;
      var solution = this.puzzle.solution;
      var codedResult = this._encrypt( solution.result.toString() );
      var codedTerms = [];
      $.each(solution.terms, function(i, term){
        codedTerms.push( widget._encrypt(term.toString()) );
      });
      this.puzzle.coded = { terms: codedTerms, result: codedResult };
    },

    // fetch 10 random character as our cipher for digits 0 - 9
    _generateCipher: function () {
      var shuffleAlhabet = alphabet.slice().sort( function(){ 
        return 0.5 - Math.random();
      }).slice(0, 10);
      this.cipher = {};
      for (var i = 0; i < shuffleAlhabet.length; i++) {
        this.cipher[i] = shuffleAlhabet[i];
      };
    },

    // returns a number between min and max
    _randomFromRange: function (min, max) {
      return Math.floor( Math.random() * (max - min) + min );
    },

    // focus() corresponding input when an alpha key is pressed
    _handleHotkeys: function (e) {
      var letter = String.fromCharCode(e.which);
      var input = this.keypad.find("[name='"+letter+"']");
      if(input.length !== 0) {
        input.focus();
        e.preventDefault();
      }
    },

    // handle delete and backspace keys
    _handleDelete: function (e) {
      var input = $(e.target);
      if( e.which === 46 || e.which === 8 ){
        this._trigger("unassignkey", null, {
            "letter": input.attr("name")
        });
      }
    },

    // Validates user input and tell widget a new key is available
    _handleInput: function (e) {
      var num = String.fromCharCode(e.which);
      var input = $(e.target);
      // ignore non-alphanumerical inputs
      if ( !/^[0-9]+/.test(num) ) { 
        if ( !/^[a-zA-Z]+/.test(num) ) { 
          e.preventDefault();
        }
        return; 
      }

      // signal new valid key
      this._trigger("assignkey", null, {
          "letter": input.attr("name"),
          "previous": input.val(),
          "value": num
      });

      // constrain input value to 1 character
      if(input.val().length > 0) { input.val(""); }

    },

    _createPuzzleDisplay: function () {
      var el = $("<div/>");
      var currentSolution = el.clone().addClass("ry-cryptarithm-operation")
      .addClass("ry-cryptarithm-" + this.options.operation);
      el.clone().addClass("ry-cryptarithm-term").appendTo(currentSolution);
      el.clone().addClass("ry-cryptarithm-term").appendTo(currentSolution);
      el.clone().addClass("ry-cryptarithm-result").appendTo(currentSolution);
      this.puzzleDisplay.html(currentSolution);
    },

    _updateDisplay: function () {
      var guess = this.puzzle.guess;
      var puzzleContainer = this.shell.find(".ry-cryptarithm-operation");
      var result = puzzleContainer.find(".ry-cryptarithm-result").text( guess.result );
      var terms = puzzleContainer.find(".ry-cryptarithm-term");
      $.each(terms, function (i, term) {
        $(term).text(guess.terms[i]);
      });
      if(guess.valid){ 
        puzzleContainer.addClass("solved");
      } else {
        puzzleContainer.removeClass("solved");
      }
    },

    // decrypt puzzle with current keys
    // stores current state of decryption in puzzle.guess
    _processSolution: function(){
      var widget = this;
      var operation = operations[this.options.operation];
      var solution = this.puzzle.solution;
      var isValidSolution = true;
      var decryptedTerms = [];
      var decryptedResult = this._decrypt( this.puzzle.coded.result );
      var decrypted;
      // decrypt each term and store it as a number if it is one
      // else we know the solution cannot be valid
      $.each( this.puzzle.coded.terms, function (i, term) {
        decrypted = widget._decrypt(term);
        if ( isNaN(decrypted) ) {
          isValidSolution = false;
        } else {
          decrypted = parseInt(decrypted);
        }
        decryptedTerms.push( decrypted );
      });

      // if we're dealing with numbers only we can check the result
      if( isValidSolution ){
        computedResult = operation.computeMethod( decryptedTerms );
        isValidSolution = (computedResult === parseInt(decryptedResult));
      }

      this.puzzle.guess = { 
        terms: decryptedTerms, 
        result: decryptedResult,
        valid: isValidSolution
      };
    },

    // puzzle a message using current keys
    _decrypt: function (text) {
      return this._substitute(text, this.keys);
    },
    // encrypts a message using cipher
    _encrypt: function (text) {
      return this._substitute(text, this.cipher);
    },
    // substitutes text's characters with array of keys
    _substitute: function (text, keys) {
      keys = keys || this.keys;
      $.each(keys, function(key, value) {
        text = text.replace(new RegExp( key, "gi") , value);
      });
      return text;
    },

    _createWrapper: function () {
      var el = $('<div/>');
      this.shell = el.clone().addClass("ry-cryptarithm-shell ui-corner-all ui-widget-content");
      this.displays = el.clone().addClass("ry-cryptarithm-displays");
      this.displays.appendTo(this.shell);
      this.puzzleDisplay = el.clone().addClass("ry-cryptarithm-puzzle").appendTo(this.displays);
      // input key pad
      this.keypad = el.clone().addClass("ry-cryptarithm-keys").appendTo(this.shell);
    },

    _createKeypad: function () {
      var el = $("<div/>");
      var eli = $("<input/>");
      var ell = $("<label/>");
      var elb = $("<button/>");
      var container = this.keypad;
      var widget = this;
      $.each( alphabet, function(i, letter) {
        var key = el.clone().addClass("ry-cryptarithm-key ui-corner-all");
        ell.clone().text(letter).attr( "for",letter).appendTo(key)
        .addClass("ui-widget-header ui-corner-all");
        eli.clone().attr("name", letter).appendTo(key);
        key.appendTo(container);
      });
      //create key reset
      elb.clone().text("Reset Keys").appendTo(container)
      .addClass("ry-cryptarithm-reset ui-corner-all ui-helper-clearfix");
    },

    _renderMarkup: function () {
      this.shell.appendTo(this.element);
    },

    _setOption: function (key, val) {
      switch(key){
        case "operation":
          var operation = operations[val];
          if( !operation ) {
            console.log("unsupported operation " + val);
            return;
          }
          break;
      }
      this._super(key, val);
      this._generatePuzzle();
      this._unassignKeys();
      this._processSolution();
      this._createPuzzleDisplay();
      this._updateDisplay();
    },

    _destroy: function () {
      this.element.removeClass("ry-cryptarithm");
      this.element.empty();
      this._super();
    }

  });

}(jQuery));