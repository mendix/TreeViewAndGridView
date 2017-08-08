define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/html",
    "dojo/dom-attr",
    "dojo/dom-style",
    "TreeView/widget/Commons",
    "TreeView/widget/Commons/Checkbox",
    "TreeView/widget/Commons/Dropdown"
], function(declare, lang, html, attr, domStyle, Commons, Checkbox, DropDown) {
    "use strict";

    return declare("TreeView.widget.Commons.ColRenderer", null, {
        columnname: "",
        columnentity: "",
        columnrendermode: "",
        columnattr: "",
        columnimage: "",
        columnaction: "",
        columnclazz: "",
        columnstyle: "",
        columndateformat: "",
        columntruecaption: "",
        columnfalsecaption: "",
        columneditdataset: "",
        columneditable: false,
        columneditautocommit: true,
        columnonchangemf: "",
        columncondition: "",
        columnprefix: "",
        columnpostfix: "",

        colindex: -1,
        tree: null,
        condition: null,
        toDestruct: null,

        constructor: function (args, tree, colindex) {
            dojo.mixin(this, args);
            this.toDestruct = [];
            this.columnstyle = this.columnstyle ? this.columnstyle.split(/\||\n/).join(";") : ""; //XXX: modeler does not export ";" separated css attributes correctly. Allow newlines and pipes as separators

            this.tree = tree;
            this.colindex = colindex;

            if ((this.columneditable && this.columnattr.indexOf("/") > -1) || (this.columnrendermode === "dataset")) {
                this.dataset = this.tree.dataset[this.columneditdataset];
                if (this.dataset === null){
                    this.tree.configError("Unknown dataset for editable reference '" + this.columnattr + "': " + this.columneditdataset + "'");
                }
            }

            if (this.columncondition) {
                this.condition = this.tree.conditions[this.columncondition];
                if (!this.condition)
                    this.tree.configError("Undefined condition \"" + this.columncondition + "\" for \"" + this.columnattr + "\"");
            }

        },

        appliesTo: function (renderNode) {
            return renderNode.isA(this.columnentity);
        },

        setupNode: function (parentNode) {
            attr.set(parentNode.parentNode, "style", this.columnstyle);
            dojo.addClass(parentNode.parentNode, this.columnclazz);

            mxui.dom.data(parentNode.parentNode, "colindex", this.colindex);
        },

        createDefaultImage: function (parentNode) {
            if (this.columnimage) {
                dojo.place(mxui.dom.create("img", {
                    //"class" : "gg_img " + this.columnclazz,
                    //"style" : this.columnstyle,
                    "src": this.columnimage
                }), parentNode, "first");
            }
        },

        invokeAction: function (record) {
            if (this.columnaction)
                this.tree.actionsByName[this.columnaction].invoke(record);
        },

        applyChange: function (record, newvalue, remove) {
            Commons.store(
                record.data(),
                this.dataset ? this.dataset.getAssoc() : this.columnattr,
                newvalue,
                this.dataset && this.dataset.isRefSet() && remove === true ? "rem" : "add",
                this.columneditautocommit && !this.columnonchangemf, //MWE: ignore auto commit setting if onchange is used
                lang.hitch(this, this._fireOnChange, record)
            );
        },

        _fireOnChange: function (record) {
            if (this.columnonchangemf)
                Commons.mf(this.columnonchangemf, record.data(), function () {
                }, this.tree);
        },

        renderEditable: function (record, domNode, firstTime) {
            if (!firstTime)
                return;

            var attrtype = Commons.getAttributeType(this.columnentity, this.columnattr);

            //dropdown with reference selector dropdown
            if (this.columnattr.indexOf("/") > -1) {
                this.toDestruct.push(new DropDown({
                        value: Commons.objectToGuid(record.data().get(this.columnattr.split("/")[0])), //can be both guid and nothing
                        onChange: lang.hitch(this, this.applyChange, record),
                        sticky: !this.dataset.isRefSet(),
                        className: "gv_columnedit_dropdownmenu",
                        dataset: this.dataset,
                        label: this.dataset.rellabel
                    },
                    domNode,
                    record
                ));

            } else if (attrtype === "Enum" || (attrtype === "Boolean" && (this.columntruecaption || this.columnfalsecaption))) {
                var items = [];

                //boolean
                if (attrtype === "Boolean"){
                    items = [
                        {value: true, label: this.columntruecaption || "Yes"},
                        {value: false, label: this.columnfalsecaption || "No"}
                    ];

                //enum map
                } else {
                    var em = Commons.getEnumMap(this.columnentity, this.columnattr);
                    for (var i = 0; i < em.length; i++){
                        items.push({value: em[i].key, label: em[i].caption});
                    }
                }

                //setup dropdown
                Commons.getObjectAttrAsync(record.data(), this.columnattr, false, lang.hitch(this, function (value) {
                    this.toDestruct.push(new DropDown({
                            options: items,
                            value: value,
                            onChange: lang.hitch(this, this.applyChange, record),
                            sticky: true,
                            className: "gv_columnedit_dropdownmenu"
                        },
                        domNode,
                        record
                    ));
                }));
            } else if (attrtype === "Boolean") {
                Commons.getObjectAttrAsync(record.data(), this.columnattr, false, lang.hitch(this, function (value) {
                    new Checkbox({
                            value: value,
                            onChange: lang.hitch(this, this.applyChange, record),
                            className: "gv_columnedit_checkbox"
                        },
                        domNode
                    );
                }));
            }
            else {
                this.tree.configError("This widget does not currently support edit for property " + this.columnattr + " type: " + attrtype);
            }
        },

        render: function (record, domNode, firstTime) {
            logger.debug("ColRenderer.render");
            if (this.columnaction !== ""){
                dojo.addClass(domNode, "gg_clickable");
            }

            if (this.condition) {
                this.condition.appliesToAsync(record, lang.hitch(this, function (applied) {
                    if (applied) {
                        this.renderRecord(record, domNode, firstTime);
                    } else {
                        domStyle.set(domNode.parentNode, "display", "none");
                        return; //hide
                    }
                }));
            } else {
                this.renderRecord(record, domNode, firstTime);
            }
        },

        renderRecord: function (record, domNode, firstTime) {
            logger.debug("ColRenderer.renderRecord");
            domStyle.set(domNode.parentNode, "display", "");

            switch (this.columnrendermode) {
                case "attribute":
                    if (this.columneditable) {
                        this.renderEditable(record, domNode, firstTime);
                    } else {
                        dojo.empty(domNode);
                        var attrtype = Commons.getAttributeType(this.columnentity, this.columnattr);

                        //Boolean value?
                        if (attrtype === "Boolean" && !(this.columntruecaption || this.columnfalsecaption)) {
                            this.createDefaultImage(domNode);

                            Commons.getObjectAttrAsync(record.data(), this.columnattr, false, lang.hitch(this, function (value) {
                                new Checkbox({ //TODO: MWE, when cleaned up?
                                        value: value,
                                        className: "gv_columnview_checkbox",
                                        readOnly: true
                                    },
                                    domNode
                                );
                            }));

                        } else {//Any other value
                            this._renderAttrAsync(record, lang.hitch(this, function (value) {
                                if (value === null || value === undefined){
                                    value = "";
                                }

                                html.set(domNode, this.columnprefix + mxui.dom.escapeString(value).replace(/\n/g, "<br/>") + this.columnpostfix);
                                attr.set(domNode, "title", value);

                                this.createDefaultImage(domNode);
                            }));
                        }
                    }

                    break;
                case "caption":
                    if (firstTime) {
                        domNode.innerHTML = this.columnprefix + this.columnname + this.columnpostfix;
                        this.createDefaultImage(domNode);
                    }
                    break;
                case "attributehtml":
                    Commons.getObjectAttrAsync(record.data(), this.columnattr, false, lang.hitch(this, function (value) {
                        domNode.innerHTML = this.columnprefix + value + this.columnpostfix;
                        this.createDefaultImage(domNode);
                    }));
                    break;
                case "attributeimage":
                    dojo.empty(domNode);

                    Commons.getObjectAttrAsync(record.data(), this.columnattr, false, lang.hitch(this, function (url) {
                        if (!url){
                            url = this.columnimage;
                        }
                        domNode.appendChild(mxui.dom.create("img", {
                            //"class" : "gg_img " + this.columnclazz,
                            //"style" : this.columnstyle,
                            "src": url
                        }));
                    }));

                    break;
                case "image":
                    if (firstTime === true){
                        this.createDefaultImage(domNode);
                    }
                    break;
                case "thumbnail" :
                    dojo.empty(domNode);

                    Commons.getObjectAttrAsync(record.data(), this.columnattr === "" ? "FileID" : this.columnattr, false, lang.hitch(this, function (fileid) {
                        Commons.getObjectAttrAsync(record.data(), this.columnattr.replace(/FileID/, "") + "changedDate", false, lang.hitch(this, function (cd) {
                            domNode.appendChild(mxui.dom.create("img", {
                                //"class" : "gg_img " + this.columnclazz,
                                //"style" : this.columnstyle,
                                "src": "file?thumb=true&target=internal&fileID=" + fileid + "&changedDate=" + cd
                            }));
                        }));
                    }));

                    break;
                case "systemimage" :
                    dojo.empty(domNode);

                    Commons.getObjectAttrAsync(record.data(), this.columnattr === "" ? "FileID" : this.columnattr, false, lang.hitch(this, function (fileid) {
                        Commons.getObjectAttrAsync(record.data(), this.columnattr.replace(/FileID/, "") + "changedDate", false, lang.hitch(this, function (cd) {
                            domNode.appendChild(mxui.dom.create("img", {
                                //"class" : "gg_img " + this.columnclazz,
                                //"style" : this.columnstyle,
                                "src": "file?thumb=true&target=internal&fileID=" + fileid + "&changedDate=" + cd
                            }));
                        }));
                    }));

                    break;
                case "dataset":
                    //only subscribe when the record is new
                    dojo.empty(domNode);

                    if (firstTime === true) {
                        record.addSubscription(dojo.connect(this.dataset, "onReceiveItems", lang.hitch(this, function (items) {
                            this.render(record, domNode);
                        })));
                    }

                    var guids = record.data().getReferences(this.dataset.getAssoc());
                    if (this.dataset.hasData) {
                        dojo.forEach(guids, function (guid) {
                            var value = this.dataset.getValue(guid);
                            if (value) {
                                dojo.place(
                                    Commons.renderLabel(
                                        value,
                                        this.columneditable,
                                        {
                                            owner: record,
                                            guid: guid,
                                            dataset: this.columneditdataset,
                                            colindex: this.colindex
                                        }
                                    ), domNode
                                );
                            }
                        }, this);
                    }
                    break;
                default:
                    this.tree.configError("not implemented columnrendermode: " + this.columnrendermode);
            }
        },

        _renderAttrAsync: function (record, cb) {
            var object = record.data();
            var attrtype = Commons.getAttributeType(object, this.columnattr);
            Commons.getObjectAttrAsync(object, this.columnattr, attrtype !== "DateTime", lang.hitch(this, function (value) {
                if (attrtype === "DateTime") {
                    if (!value || "" === value){
                        return cb("");
                    }
                    return cb(dojo.date.locale.format(new Date(value), {
                        selector: "date",
                        datePattern: this.columndateformat !== "" ? this.columndateformat : "EEE dd MMM y"
                    }));
                } else if (attrtype === "Boolean" && (this.columntruecaption || this.columnfalsecaption)){
                    return cb(value === "Yes" ? this.columntruecaption : this.columnfalsecaption);
                }
                return cb(value);
            }));
        },

        free: function () {
            dojo.forEach(this.toDestruct, function (item) {
                item.free();
            });
        }
    });
});
