$(function(){
  // load application_.json data
  var magazines_list = $('.magazines').eq(0),
  app_data,
  MAG_TYPE_FREE = 'Free',
  MAG_TYPE_PAID = 'Paid',
  refresh_timeout;
  magazines_init(magazines_list);
  $.ajax('application_.json', {
    dataType: 'json'
  }).done(function(data)
     {
       // get update rate it's in minutes
       var q = querystring.parse(get_url_query(data.root_view)) || {},
       update_every = parseFloat(q.waupdate);
       data.update_every = (isNaN(update_every) ? 30 : update_every)*60*1000;
       app_data = data;
       magazines_load(data, magazines_list, magazines_loaded_handle);

       // set background
       if(data.background)
         $('.reader-background').css('backgroundImage', 
                  'url("' + magazine_file_url(data, data.background) +'")');
     })
  .fail(function(jqXHR, textStatus, err)
     {
       notifyError("Couldn't load application_.json: " + textStatus);
     })
  function magazines_loaded_handle(err)
  {
    notifyIfError(err);
    if(refresh_timeout !== undefined)
      clearTimeout(refresh_timeout);
    refresh_timeout = setTimeout(function()
      {
        magazines_load(app_data, magazines_list, magazines_loaded_handle);
        refresh_timeout = undefined;
      }, app_data.update_every);
  }
  function notifyIfError(err)
  {
    if(err)
      return notifyError(err);
  }
  function magazines_init(list)
  {
    list.dhtml('list_init');
    function catchLIElement(el)
    {
      var li = $(el).parent();
      while(li.prop('tagName') != 'LI')
        li = li.parent();
      if(li.prop('tagName') != 'LI')
        return null;
      return li;
    }
    list.on('click', '.mag-sample-btn, .mag-read-btn', function()
      {
        var li = catchLIElement(this)
        if(!li)
          return;
        var item = li.data('item'),
        fn = paid2free(item.FileName),
        ext = path.extname(fn), url;
        if($(this).hasClass('mag-read-btn') && item.type != MAG_TYPE_FREE)
        {
          read_paid_file(item);
        }
        else
        {
          if(ext == '.pdf')
            url = 'pdfreader.html?waurl=' + 
            encodeURIComponent(magazine_file_key(app_data, fn));
          else
            url = magazine_file_url(app_data, fn);
        
          window.open(url, '_blank');
        }
        return false;
      });
  }
  function read_paid_file(item)
  {
    var type = app_data.CodeService ? 'code' : 
      (app_data.UserService ? 'user' : null);
    if(!type)
      return;
    purchase_dialog_open({
      type: type,
      client: app_data.client_name,
      app: app_data.app_name, 
      service: type == 'user' ? app_data.UserService : 
        app_data.CodeService,
      urlstring: magazine_file_key(app_data, item.FileName),
      deviceid: 'browser'
    });
  }
  function magazines_create_item(item, data, list)
  {
    var defined_objects = {
      magazines: {
        read_btn: 'Read',
        sample_btn: 'Sample'
      }
    };
    var li = list.dhtml('list_new_item', null, [ item, defined_objects ]);
    li.addClass('mag-type-' + (item.type == MAG_TYPE_PAID ? 'paid' : 'free'));
    return li;
  }
  function magazines_load(data, list, cb)
  {
    $.ajax(magazines_url(data), {
      dataType: 'xml'
    }).success(function(xml)
         {
           var items = $.plist(xml);
           if(!items)
             return cb && cb(new Error("Counldn't parse Magazines.plist"));
           list.html('');
           for(var i = 0, l = items.length; i < l; ++i)
           {
             var item = items[i],
             fn = item.FileName;
             item.type = magazine_type(fn);
             item.ThumbnailUrl = 
               magazine_file_url(data, magazine_get_thumbnail_by_filename(fn))
             list.append(magazines_create_item(item, data, list)
                         .data('item', item));
           }
           cb && cb(null, items);
         })
      .fail(function(xhr, textStatus, err)
         {
           cb && cb(new Error("Couldn't load Magazines.plist: " + textStatus));
         });
  }
  function magazine_file_url(data, file)
  {
    return '//' + config.s3Bucket + '.s3.amazonaws.com/' + 
      magazine_file_key(data, file);
  }
  function magazine_file_key(data, file)
  {
    return data.client_name + '/' + data.magazine_name + '/' + file;
  }
  function magazines_url(data)
  {
    return  magazine_file_url(data, data.root_view);
  }
  function magazine_get_thumbnail_by_filename(fn)
  {
    return paid2free(fn, true) + '.png';
  }
  function magazine_type(fn)
  {
    var bn = path.basename(fn, path.extname(fn));
    return bn.length > 0 && bn[bn.length - 1] == '_' ? 
      MAG_TYPE_PAID : MAG_TYPE_FREE;
  }
  function paid2free(fn, noext)
  {
    var ext = path.extname(fn),
    bn = path.join(path.dirname(fn), path.basename(fn, ext));
    return (bn.length > 0 && bn[bn.length - 1] == '_' ? 
            bn.substr(0, bn.length - 1) : bn) + (noext ? '' : ext);
  }
});
