module.exports = (callback, fun) ->
  if fun instanceof Error
    Promise.reject fun
  else try
    promise = new Promise fun
    if callback
      promise.then do
        !-> callback null, it
        !-> callback it
    promise
  catch ex
    Promise.reject ex
